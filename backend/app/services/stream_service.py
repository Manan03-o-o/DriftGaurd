import pandas as pd
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.database.models import StreamSession, PredictionBatch, ModelRegistration, MonitoringWindow
from app.schemas.streams import StreamReplayRequest
from app.ml.data_generation import get_dataset, simulate_stream_batch
from app.ml.training import load_model_artifact
from app.ml.drift_detection import detect_window_drift
from app.core.logging import logger


class StreamService:
    @staticmethod
    def replay_stream(db: Session, request: StreamReplayRequest) -> StreamSession:
        model = db.query(ModelRegistration).filter(ModelRegistration.id == request.model_id).first()
        if not model:
            raise ValueError(f"Model {request.model_id} not found")

        # Load baseline dataset to serve as reference
        baseline_df = get_dataset(dataset_name=model.dataset_name)
        target_col = model.feature_schema.get("target_col", "default")
        
        # Load trained model pipeline
        pipeline = load_model_artifact(model.artifact_path)

        stream = StreamSession(
            name=f"Stream-{request.scenario}-{request.total_batches}x{request.batch_size}",
            model_id=model.id,
            dataset_name=model.dataset_name,
            scenario=request.scenario,
            batch_size=request.batch_size,
            total_batches=request.total_batches
        )
        db.add(stream)
        db.commit()
        db.refresh(stream)

        # Generate each batch
        for b_idx in range(request.total_batches):
            X_batch, y_batch = simulate_stream_batch(
                reference_df=baseline_df,
                batch_size=request.batch_size,
                scenario=request.scenario,
                batch_index=b_idx,
                random_seed=request.random_seed,
                target_col=target_col
            )

            # Perform inference
            preds = pipeline.predict(X_batch)
            probs = pipeline.predict_proba(X_batch)[:, 1] if hasattr(pipeline, "predict_proba") else [0.5] * len(preds)

            predictions_payload = [
                {"pred": int(p), "prob": float(round(pr, 4))}
                for p, pr in zip(preds, probs)
            ]

            data_payload = X_batch.to_dict(orient="records")

            batch_record = PredictionBatch(
                stream_id=stream.id,
                model_id=model.id,
                batch_index=b_idx,
                records_count=len(X_batch),
                data_payload=data_payload,
                predictions=predictions_payload,
                ground_truth_labels=y_batch.tolist()
            )
            db.add(batch_record)
            db.commit()
            db.refresh(batch_record)

            # Auto analyze drift if requested
            if request.auto_analyze_drift:
                num_features = model.feature_schema.get("numerical_features")
                cat_features = model.feature_schema.get("categorical_features")
                
                drift_res = detect_window_drift(
                    baseline_df=baseline_df.drop(columns=[target_col], errors="ignore"),
                    current_df=X_batch,
                    numerical_features=num_features,
                    categorical_features=cat_features
                )

                window = MonitoringWindow(
                    model_id=model.id,
                    stream_id=stream.id,
                    batch_id=batch_record.id,
                    window_name=f"Batch #{b_idx + 1} ({request.scenario})",
                    sample_size=len(X_batch),
                    overall_drift_status=drift_res["overall_drift_status"],
                    overall_psi=drift_res["mean_psi"],
                    drifted_features_count=drift_res["drifted_features_count"],
                    total_features_count=drift_res["total_features_count"],
                    feature_results=drift_res["feature_results"],
                    notes=f"Replay batch {b_idx + 1}/{request.total_batches} scenario '{request.scenario}'"
                )
                db.add(window)
                db.commit()

        db.refresh(stream)
        return stream

    @staticmethod
    def get_stream_by_id(db: Session, stream_id: str) -> Optional[StreamSession]:
        return db.query(StreamSession).filter(StreamSession.id == stream_id).first()

    @staticmethod
    def get_batch_by_id(db: Session, batch_id: str) -> Optional[PredictionBatch]:
        return db.query(PredictionBatch).filter(PredictionBatch.id == batch_id).first()
