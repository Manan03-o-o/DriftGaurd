import pandas as pd
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.database.models import MonitoringWindow, ModelRegistration, PredictionBatch
from app.schemas.drift import DriftAnalysisRequest, DriftSummaryResponse, MonitoringWindowResponse
from app.ml.data_generation import get_dataset
from app.ml.drift_detection import detect_window_drift


class DriftService:
    @staticmethod
    def analyze_drift(db: Session, request: DriftAnalysisRequest) -> MonitoringWindow:
        model = db.query(ModelRegistration).filter(ModelRegistration.id == request.model_id).first()
        if not model:
            raise ValueError(f"Model {request.model_id} not found")

        baseline_df = get_dataset(dataset_name=model.dataset_name)
        target_col = model.feature_schema.get("target_col", "default")
        base_clean = baseline_df.drop(columns=[target_col], errors="ignore")

        # Determine current data
        if request.current_data is not None and len(request.current_data) > 0:
            current_df = pd.DataFrame(request.current_data)
        elif request.batch_id:
            batch = db.query(PredictionBatch).filter(PredictionBatch.id == request.batch_id).first()
            if not batch:
                raise ValueError(f"Batch {request.batch_id} not found")
            current_df = pd.DataFrame(batch.data_payload)
        else:
            raise ValueError("Either current_data or batch_id must be provided for analysis")

        num_features = model.feature_schema.get("numerical_features")
        cat_features = model.feature_schema.get("categorical_features")

        drift_res = detect_window_drift(
            baseline_df=base_clean,
            current_df=current_df,
            numerical_features=num_features,
            categorical_features=cat_features,
            alpha=request.alpha
        )

        window = MonitoringWindow(
            model_id=model.id,
            stream_id=request.stream_id,
            batch_id=request.batch_id,
            window_name=request.window_name,
            sample_size=len(current_df),
            overall_drift_status=drift_res["overall_drift_status"],
            overall_psi=drift_res["mean_psi"],
            drifted_features_count=drift_res["drifted_features_count"],
            total_features_count=drift_res["total_features_count"],
            feature_results=drift_res["feature_results"],
            notes=f"Analyzed {len(current_df)} rows against baseline {model.dataset_name}"
        )
        db.add(window)
        db.commit()
        db.refresh(window)
        return window

    @staticmethod
    def get_monitoring_history(db: Session, model_id: Optional[str] = None, limit: int = 50) -> List[MonitoringWindow]:
        query = db.query(MonitoringWindow)
        if model_id:
            query = query.filter(MonitoringWindow.model_id == model_id)
        return query.order_by(MonitoringWindow.created_at.desc()).limit(limit).all()

    @staticmethod
    def get_drift_summary(db: Session, model_id: Optional[str] = None) -> Dict[str, Any]:
        query = db.query(MonitoringWindow)
        if model_id:
            query = query.filter(MonitoringWindow.model_id == model_id)
        
        all_windows = query.order_by(MonitoringWindow.created_at.desc()).all()
        total_count = len(all_windows)

        status_counts = {"NONE": 0, "LOW": 0, "MEDIUM": 0, "HIGH": 0}
        feature_drift_counts: Dict[str, int] = {}

        for w in all_windows:
            status = w.overall_drift_status or "NONE"
            status_counts[status] = status_counts.get(status, 0) + 1
            if isinstance(w.feature_results, dict):
                for f_name, f_data in w.feature_results.items():
                    if isinstance(f_data, dict) and f_data.get("drift_detected"):
                        feature_drift_counts[f_name] = feature_drift_counts.get(f_name, 0) + 1

        active_alerts = status_counts.get("MEDIUM", 0) + status_counts.get("HIGH", 0)
        latest_status = all_windows[0].overall_drift_status if all_windows else "NONE"

        most_drifted = [
            {"feature": k, "drift_occurrences": v}
            for k, v in sorted(feature_drift_counts.items(), key=lambda x: x[1], reverse=True)[:5]
        ]

        return {
            "total_windows_analyzed": total_count,
            "active_alerts_count": active_alerts,
            "latest_window_status": latest_status,
            "status_distribution": status_counts,
            "most_drifted_features": most_drifted,
            "recent_windows": all_windows[:10]
        }
