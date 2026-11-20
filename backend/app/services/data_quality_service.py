import io
import pandas as pd
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.database.models import DataQualityAudit, ModelRegistration
from app.ml.data_generation import get_dataset
from app.ml.data_quality import evaluate_data_quality
from app.core.logging import logger


class DataQualityService:
    @staticmethod
    def audit_model_dataset(
        db: Session,
        model_id: str,
        records: Optional[List[Dict[str, Any]]] = None,
        dataset_name: Optional[str] = None
    ) -> DataQualityAudit:
        model = db.query(ModelRegistration).filter(ModelRegistration.id == model_id).first()
        if not model:
            raise ValueError(f"Model '{model_id}' not found")

        name = dataset_name or model.dataset_name
        if records and len(records) > 0:
            df = pd.DataFrame(records)
        else:
            df = get_dataset(dataset_name=name)

        target_col = model.feature_schema.get("target_col", "default")
        df_features = df.drop(columns=[target_col], errors="ignore")

        eval_res = evaluate_data_quality(df_features, model.feature_schema)

        audit = DataQualityAudit(
            model_id=model.id,
            dataset_name=name,
            records_count=eval_res["records_count"],
            overall_score=eval_res["overall_score"],
            missing_values_count=eval_res["missing_values_count"],
            missing_percentage=eval_res["missing_percentage"],
            duplicate_rows_count=eval_res["duplicate_rows_count"],
            outlier_count=eval_res["outlier_count"],
            schema_valid=eval_res["schema_valid"],
            validation_errors=eval_res["validation_errors"],
            feature_scores=eval_res["feature_scores"]
        )
        db.add(audit)
        db.commit()
        db.refresh(audit)
        logger.info(f"Data quality audit completed for model {model.name}: score={audit.overall_score}%")
        return audit

    @staticmethod
    def audit_uploaded_csv(
        db: Session,
        model_id: str,
        file_contents: bytes,
        filename: str
    ) -> DataQualityAudit:
        model = db.query(ModelRegistration).filter(ModelRegistration.id == model_id).first()
        if not model:
            raise ValueError(f"Model '{model_id}' not found")

        try:
            df = pd.read_csv(io.BytesIO(file_contents))
        except Exception as e:
            raise ValueError(f"Could not parse CSV file: {str(e)}")

        target_col = model.feature_schema.get("target_col", "default")
        df_features = df.drop(columns=[target_col], errors="ignore")

        eval_res = evaluate_data_quality(df_features, model.feature_schema)

        audit = DataQualityAudit(
            model_id=model.id,
            dataset_name=f"upload:{filename}",
            records_count=eval_res["records_count"],
            overall_score=eval_res["overall_score"],
            missing_values_count=eval_res["missing_values_count"],
            missing_percentage=eval_res["missing_percentage"],
            duplicate_rows_count=eval_res["duplicate_rows_count"],
            outlier_count=eval_res["outlier_count"],
            schema_valid=eval_res["schema_valid"],
            validation_errors=eval_res["validation_errors"],
            feature_scores=eval_res["feature_scores"]
        )
        db.add(audit)
        db.commit()
        db.refresh(audit)
        logger.info(f"Uploaded CSV audit completed: {filename} score={audit.overall_score}%")
        return audit

    @staticmethod
    def get_quality_history(
        db: Session,
        model_id: Optional[str] = None,
        limit: int = 20
    ) -> List[DataQualityAudit]:
        query = db.query(DataQualityAudit)
        if model_id:
            query = query.filter(DataQualityAudit.model_id == model_id)
        return query.order_by(DataQualityAudit.created_at.desc()).limit(limit).all()
