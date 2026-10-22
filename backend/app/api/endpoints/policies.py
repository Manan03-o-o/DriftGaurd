from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.schemas.experiments import PolicyExperimentRequest, ExperimentResponse
from app.services.experiment_service import ExperimentService
from app.services.model_service import ModelService

router = APIRouter()


@router.post("/evaluate", response_model=ExperimentResponse)
def evaluate_retraining_policies(request: PolicyExperimentRequest, db: Session = Depends(get_db)):
    try:
        if not request.model_id or request.model_id == "default":
            active_model = ModelService.get_active_or_latest_model(db)
            if not active_model:
                active_model = ModelService.ensure_default_model(db)
            request.model_id = active_model.id

        experiment = ExperimentService.run_experiment(db, request)
        return experiment
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Policy experiment failed: {str(e)}")


@router.get("/experiments", response_model=List[ExperimentResponse])
def list_experiments(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db)
):
    experiments = ExperimentService.get_experiments(db, skip=skip, limit=limit)
    return experiments


@router.get("/experiments/{experiment_id}", response_model=ExperimentResponse)
def get_experiment(experiment_id: str, db: Session = Depends(get_db)):
    experiment = ExperimentService.get_experiment_by_id(db, experiment_id)
    if not experiment:
        raise HTTPException(status_code=404, detail=f"Experiment '{experiment_id}' not found")
    return experiment
