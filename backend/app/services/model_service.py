import os
import numpy as np
import pandas as pd
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from app.database.models import ModelRegistration
from app.schemas.models import ModelTrainRequest
from app.ml.data_generation import get_dataset
from app.ml.training import train_baseline_model, save_model_artifact, load_model_artifact
from app.core.logging import logger


class ModelService:
    @staticmethod
    def train_and_register_model(db: Session, request: ModelTrainRequest) -> ModelRegistration:
        logger.info(f"Initiating training for model '{request.name}' algorithm='{request.algorithm}' dataset='{request.dataset_name}'")
        
        # Load baseline dataset
        df = get_dataset(
            dataset_name=request.dataset_name,
            n_samples=request.n_samples,
            random_seed=request.random_seed
        )

        target_col = request.target_col
        if target_col not in df.columns:
            # Fallback if target column differs
            if "default" in df.columns:
                target_col = "default"
            elif "target" in df.columns:
                target_col = "target"
            else:
                target_col = df.columns[-1]

        # Train model pipeline
        pipeline, schema_info, baseline_metrics = train_baseline_model(
            df=df,
            target_col=target_col,
            algorithm=request.algorithm,
            random_seed=request.random_seed
        )

        model_reg = ModelRegistration(
            name=request.name,
            version=request.version,
            algorithm=request.algorithm,
            task="binary_classification",
            dataset_name=request.dataset_name,
            feature_schema=schema_info,
            baseline_metrics=baseline_metrics,
            artifact_path="",
            is_active=True
        )
        db.add(model_reg)
        db.commit()
        db.refresh(model_reg)

        # Save artifact with model id
        artifact_path = save_model_artifact(pipeline, model_reg.id)
        model_reg.artifact_path = artifact_path
        db.commit()
        db.refresh(model_reg)

        logger.info(f"Model successfully registered: ID={model_reg.id}, F1={baseline_metrics['primary_f1']}")
        return model_reg

    @staticmethod
    def get_models(db: Session, skip: int = 0, limit: int = 50) -> List[ModelRegistration]:
        return db.query(ModelRegistration).order_by(ModelRegistration.created_at.desc()).offset(skip).limit(limit).all()

    @staticmethod
    def get_model_by_id(db: Session, model_id: str) -> Optional[ModelRegistration]:
        return db.query(ModelRegistration).filter(ModelRegistration.id == model_id).first()

    @staticmethod
    def get_active_or_latest_model(db: Session) -> Optional[ModelRegistration]:
        model = db.query(ModelRegistration).filter(ModelRegistration.is_active == True).order_by(ModelRegistration.created_at.desc()).first()
        if not model:
            model = db.query(ModelRegistration).order_by(ModelRegistration.created_at.desc()).first()
        return model

    @staticmethod
    def ensure_default_model(db: Session) -> ModelRegistration:
        """
        Ensures at least one default baseline model is registered on startup
        for a seamless zero-configuration experience.
        """
        existing = db.query(ModelRegistration).first()
        if existing:
            return existing
        
        logger.info("No registered models found. Creating default baseline model...")
        req = ModelTrainRequest(
            name="Baseline-Credit-Risk-V1",
            version="1.0.0",
            algorithm="random_forest",
            dataset_name="credit_default",
            target_col="default",
            n_samples=3500,
            random_seed=42
        )
        return ModelService.train_and_register_model(db, req)

    @staticmethod
    def activate_model(db: Session, model_id: str) -> ModelRegistration:
        """
        Activates a model as the primary production model and deactivates other registered models.
        """
        target_model = db.query(ModelRegistration).filter(ModelRegistration.id == model_id).first()
        if not target_model:
            raise ValueError(f"Model with id '{model_id}' not found")

        # Deactivate all models
        db.query(ModelRegistration).update({ModelRegistration.is_active: False})
        target_model.is_active = True
        db.commit()
        db.refresh(target_model)
        logger.info(f"Model '{target_model.name}' ({target_model.id}) activated as production model.")
        return target_model

    @staticmethod
    def compare_models(
        db: Session,
        champion_id: str,
        challenger_id: str,
        tolerance: float = 0.02
    ) -> Dict[str, Any]:
        """
        Performs Champion vs Challenger evaluation comparing validation metrics,
        confusion matrices, and promotion eligibility under gating threshold.
        """
        champion = db.query(ModelRegistration).filter(ModelRegistration.id == champion_id).first()
        if not champion:
            raise ValueError(f"Champion model '{champion_id}' not found")

        challenger = db.query(ModelRegistration).filter(ModelRegistration.id == challenger_id).first()
        if not challenger:
            raise ValueError(f"Challenger model '{challenger_id}' not found")

        champ_val = champion.baseline_metrics.get("val_metrics", {})
        chall_val = challenger.baseline_metrics.get("val_metrics", {})

        champ_f1 = float(champ_val.get("f1_macro", 0.0))
        chall_f1 = float(chall_val.get("f1_macro", 0.0))
        delta_f1 = float(round(chall_f1 - champ_f1, 4))

        champ_acc = float(champ_val.get("accuracy", 0.0))
        chall_acc = float(chall_val.get("accuracy", 0.0))
        delta_acc = float(round(chall_acc - champ_acc, 4))

        champ_prec = float(champ_val.get("precision", 0.0))
        chall_prec = float(chall_val.get("precision", 0.0))
        delta_prec = float(round(chall_prec - champ_prec, 4))

        champ_rec = float(champ_val.get("recall", 0.0))
        chall_rec = float(chall_val.get("recall", 0.0))
        delta_rec = float(round(chall_rec - champ_rec, 4))

        is_eligible = bool(delta_f1 >= -tolerance)

        if delta_f1 > 0.005:
            rec = f"Challenger model outperforms Champion (+{delta_f1:.4f} Macro-F1). Strongly recommended for promotion to active production status."
        elif is_eligible:
            rec = f"Challenger model performance is within the acceptable safety tolerance window (Delta F1 = {delta_f1:+.4f}, tolerance = {tolerance:.2f}). Eligible for conditional promotion."
        else:
            rec = f"Challenger model exhibits substantial degradation (Delta F1 = {delta_f1:+.4f} below tolerance -{tolerance:.2f}). Promotion rejected by gating safety policy."

        return {
            "champion": {
                "id": champion.id,
                "name": champion.name,
                "version": champion.version,
                "algorithm": champion.algorithm,
                "dataset_name": champion.dataset_name,
                "created_at": champion.created_at.isoformat() if champion.created_at else None,
                "metrics": champ_val
            },
            "challenger": {
                "id": challenger.id,
                "name": challenger.name,
                "version": challenger.version,
                "algorithm": challenger.algorithm,
                "dataset_name": challenger.dataset_name,
                "created_at": challenger.created_at.isoformat() if challenger.created_at else None,
                "metrics": chall_val
            },
            "delta_metrics": {
                "delta_f1_macro": delta_f1,
                "delta_accuracy": delta_acc,
                "delta_precision": delta_prec,
                "delta_recall": delta_rec
            },
            "recommendation": rec,
            "is_eligible_for_promotion": is_eligible,
            "tolerance_applied": tolerance
        }

    @staticmethod
    def get_model_explainability(db: Session, model_id: str) -> Dict[str, Any]:
        """
        Extracts global feature importance and feature attribution metrics
        from the trained model pipeline artifact.
        """
        model = db.query(ModelRegistration).filter(ModelRegistration.id == model_id).first()
        if not model:
            raise ValueError(f"Model '{model_id}' not found")

        try:
            pipeline = load_model_artifact(model.artifact_path)
        except Exception as e:
            raise ValueError(f"Could not load model artifact: {str(e)}")

        preprocessor = pipeline.named_steps.get("preprocessor")
        classifier = pipeline.named_steps.get("classifier")

        if not preprocessor or not classifier:
            raise ValueError("Pipeline structure does not contain expected 'preprocessor' and 'classifier' steps")

        try:
            raw_feature_names = preprocessor.get_feature_names_out()
        except Exception:
            raw_feature_names = np.array(model.feature_schema.get("all_features", []))

        # Extract weights / importances based on classifier algorithm
        method = "Feature Importances (Ensemble Tree Split Gini Reduction)"
        if hasattr(classifier, "feature_importances_"):
            raw_importances = classifier.feature_importances_
        elif hasattr(classifier, "coef_"):
            method = "Absolute Normalized Coefficients (L2 Regularized Logistic Regression)"
            raw_importances = np.abs(classifier.coef_[0])
        else:
            method = "Uniform Attribution (Heuristic Fallback)"
            raw_importances = np.ones(len(raw_feature_names))

        total_weight = np.sum(raw_importances) if np.sum(raw_importances) > 0 else 1.0
        normalized_pct = (raw_importances / total_weight) * 100.0

        # Group one-hot encoded features back to their primary feature name
        # e.g. cat__home_ownership_RENT -> home_ownership, num__income -> income
        parent_importance_map: Dict[str, float] = {}
        items = []

        for name, imp, pct in zip(raw_feature_names, raw_importances, normalized_pct):
            clean_name = str(name)
            # Remove transformer prefix (e.g. 'num__', 'cat__')
            if "__" in clean_name:
                clean_name = clean_name.split("__", 1)[1]

            # Find parent feature from schema
            all_feats = model.feature_schema.get("all_features", [])
            parent_feat = clean_name
            for feat in all_feats:
                if clean_name.startswith(feat):
                    parent_feat = feat
                    break

            parent_importance_map[parent_feat] = parent_importance_map.get(parent_feat, 0.0) + float(pct)

            items.append({
                "feature": clean_name,
                "raw_feature": str(name),
                "importance": float(round(imp, 5)),
                "percentage": float(round(pct, 2))
            })

        # Sort aggregated parent features
        sorted_parent_features = sorted(parent_importance_map.items(), key=lambda x: x[1], reverse=True)
        aggregated_items = [
            {
                "feature": feat,
                "raw_feature": feat,
                "importance": float(round(pct / 100.0, 5)),
                "percentage": float(round(pct, 2))
            }
            for feat, pct in sorted_parent_features
        ]

        top_features = [feat for feat, _ in sorted_parent_features[:5]]

        return {
            "model_id": model.id,
            "model_name": model.name,
            "version": model.version,
            "algorithm": model.algorithm,
            "method": method,
            "feature_importances": aggregated_items,
            "top_features": top_features,
            "sample_prediction_explanation": {
                "top_risk_driver": top_features[0] if top_features else "N/A",
                "secondary_risk_driver": top_features[1] if len(top_features) > 1 else "N/A",
                "summary": f"Predictions for {model.name} are primarily influenced by {', '.join(top_features[:3])}."
            },
            "educational_disclaimer": (
                "Feature importance quantifies the relative influence of input features on model prediction logits "
                "within the trained decision boundaries. This metric captures statistical association and should not be "
                "interpreted as evidence of causal relationships or counterfactual real-world outcomes."
            )
        }
