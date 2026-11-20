from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.schemas.alerts import AlertResponse, AlertStatsResponse
from app.services.alert_service import AlertService

router = APIRouter()


@router.get("", response_model=List[AlertResponse])
def get_alerts(
    model_id: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    is_resolved: Optional[bool] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    alerts = AlertService.get_alerts(
        db,
        model_id=model_id,
        severity=severity,
        is_resolved=is_resolved,
        limit=limit
    )
    return alerts


@router.get("/stats", response_model=AlertStatsResponse)
def get_alert_stats(
    model_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    stats = AlertService.get_alert_stats(db, model_id=model_id)
    return AlertStatsResponse(**stats)


@router.patch("/{alert_id}/read", response_model=AlertResponse)
def mark_alert_as_read(alert_id: str, db: Session = Depends(get_db)):
    alert = AlertService.mark_as_read(db, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail=f"Alert '{alert_id}' not found")
    return alert


@router.patch("/{alert_id}/resolve", response_model=AlertResponse)
def resolve_alert(alert_id: str, db: Session = Depends(get_db)):
    alert = AlertService.resolve_alert(db, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail=f"Alert '{alert_id}' not found")
    return alert


@router.post("/read-all")
def mark_all_as_read(
    model_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    count = AlertService.mark_all_as_read(db, model_id=model_id)
    return {"marked_read_count": count}
