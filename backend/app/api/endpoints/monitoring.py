from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.schemas.drift import (
    DriftAnalysisRequest,
    MonitoringWindowResponse,
    DriftSummaryResponse
)
from app.services.drift_service import DriftService
from app.services.model_service import ModelService

router = APIRouter()


@router.post("/analyze", response_model=MonitoringWindowResponse)
def analyze_drift(request: DriftAnalysisRequest, db: Session = Depends(get_db)):
    try:
        if not request.model_id or request.model_id == "default":
            active_model = ModelService.get_active_or_latest_model(db)
            if not active_model:
                active_model = ModelService.ensure_default_model(db)
            request.model_id = active_model.id

        window = DriftService.analyze_drift(db, request)
        return window
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Drift analysis failed: {str(e)}")


@router.get("/summary", response_model=DriftSummaryResponse)
def get_drift_summary(model_id: Optional[str] = None, db: Session = Depends(get_db)):
    try:
        summary_data = DriftService.get_drift_summary(db, model_id=model_id)
        return summary_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not retrieve drift summary: {str(e)}")


@router.get("/history", response_model=List[MonitoringWindowResponse])
def get_monitoring_history(
    model_id: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    windows = DriftService.get_monitoring_history(db, model_id=model_id, limit=limit)
    return windows
