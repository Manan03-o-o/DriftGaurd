import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.database.models import PredictionBatch, ModelRegistration, ModelQualitySnapshot
from app.schemas.labels import AttachLabelsRequest, ModelQualityResponse, ModelQualityHistoryResponse
from app.ml.evaluation import evaluate_batch_quality

router = APIRouter()


@router.post("", response_model=ModelQualityResponse)
def attach_labels(req: AttachLabelsRequest, db: Session = Depends(get_db)):
    batch = db.query(PredictionBatch).filter(PredictionBatch.id == req.batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail=f"Prediction batch '{req.batch_id}' not found")

    if len(req.ground_truth_labels) != batch.records_count:
        raise HTTPException(
            status_code=400,
            detail=f"Label count mismatch: received {len(req.ground_truth_labels)} labels, batch has {batch.records_count} records"
        )

    model = db.query(ModelRegistration).filter(ModelRegistration.id == batch.model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Associated model not found")

    # Update batch with provided labels
    batch.ground_truth_labels = req.ground_truth_labels
    batch.labeled_at = datetime.datetime.now(datetime.timezone.utc)
    db.commit()

    # Calculate actual predictive metrics
    quality_metrics = evaluate_batch_quality(
        ground_truth_labels=req.ground_truth_labels,
        predictions=batch.predictions,
        baseline_metrics=model.baseline_metrics
    )

    snapshot = ModelQualitySnapshot(
        model_id=model.id,
        stream_id=batch.stream_id,
        batch_id=batch.id,
        samples_count=quality_metrics["samples_count"],
        accuracy=quality_metrics["accuracy"],
        precision=quality_metrics["precision"],
        recall=quality_metrics["recall"],
        f1_macro=quality_metrics["f1_macro"],
        roc_auc=quality_metrics.get("roc_auc"),
        pr_auc=quality_metrics.get("pr_auc"),
        confusion_matrix=quality_metrics["confusion_matrix"],
        delta_f1_baseline=quality_metrics["delta_f1_baseline"]
    )
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    return snapshot


@router.get("/models/{model_id}/quality", response_model=ModelQualityHistoryResponse)
def get_model_quality_history(model_id: str, db: Session = Depends(get_db)):
    model = db.query(ModelRegistration).filter(ModelRegistration.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail=f"Model '{model_id}' not found")

    snapshots = (
        db.query(ModelQualitySnapshot)
        .filter(ModelQualitySnapshot.model_id == model_id)
        .order_by(ModelQualitySnapshot.created_at.desc())
        .all()
    )

    current_status = "HEALTHY"
    if snapshots:
        latest = snapshots[0]
        if latest.delta_f1_baseline < -0.10:
            current_status = "CRITICALLY_DEGRADED"
        elif latest.delta_f1_baseline < -0.04:
            current_status = "DEGRADED"

    return ModelQualityHistoryResponse(
        model_id=model.id,
        baseline_metrics=model.baseline_metrics,
        snapshots=snapshots,
        current_status=current_status
    )
