import datetime
import platform
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database.session import get_db
from app.database.models import (
    ModelRegistration,
    MonitoringWindow,
    Experiment,
    PredictionBatch,
    StreamSession,
    ModelQualitySnapshot,
    Alert,
    DataQualityAudit
)
from app.services.model_service import ModelService
from app.schemas.system import SystemStatusResponse
from app.core.config import settings

router = APIRouter()


@router.get("/status", response_model=SystemStatusResponse)
def get_system_status(db: Session = Depends(get_db)):
    # Check DB connectivity
    db_status = "healthy"
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    models_count = db.query(ModelRegistration).count()
    windows_count = db.query(MonitoringWindow).count()
    experiments_count = db.query(Experiment).count()

    return SystemStatusResponse(
        status="operational",
        version=settings.VERSION,
        environment=settings.ENVIRONMENT,
        database_status=db_status,
        registered_models_count=models_count,
        analyzed_windows_count=windows_count,
        total_experiments_count=experiments_count,
        system_time=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        details={
            "python_version": platform.python_version(),
            "platform": platform.platform(),
            "database_url_type": settings.DATABASE_URL.split(":")[0],
            "debug": settings.DEBUG
        }
    )


@router.post("/reset-demo")
def reset_demo_data(db: Session = Depends(get_db)):
    """
    Cleans up simulated streaming records, alerts, quality snapshots, and audits
    while preserving the baseline model registration for presentation resets.
    """
    try:
        db.query(Alert).delete()
        db.query(DataQualityAudit).delete()
        db.query(ModelQualitySnapshot).delete()
        db.query(MonitoringWindow).delete()
        db.query(PredictionBatch).delete()
        db.query(StreamSession).delete()
        db.query(Experiment).delete()
        db.commit()

        # Ensure baseline model exists
        ModelService.ensure_default_model(db)
        return {"status": "success", "message": "Demo data safely reset to clean baseline."}
    except Exception as e:
        db.rollback()
        return {"status": "error", "message": str(e)}
