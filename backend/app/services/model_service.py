import os
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
