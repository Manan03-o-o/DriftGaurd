import pandas as pd
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.schemas.models import (
    ModelTrainRequest,
    ModelRegistrationResponse,
    ModelEvaluateRequest,
    ModelPredictionResponse,
    ModelComparisonRequest,
    ModelComparisonResponse,
    ModelExplainabilityResponse
)
from app.services.model_service import ModelService
from app.ml.training import load_model_artifact, evaluate_predictions

router = APIRouter()


@router.post("", response_model=ModelRegistrationResponse)
@router.post("/train", response_model=ModelRegistrationResponse)
def train_and_register_model(request: ModelTrainRequest, db: Session = Depends(get_db)):
    try:
        model = ModelService.train_and_register_model(db, request)
        return model
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Training failed: {str(e)}")


@router.get("", response_model=List[ModelRegistrationResponse])
def get_registered_models(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    models = ModelService.get_models(db, skip=skip, limit=limit)
    if not models:
        # Auto-initialize baseline model
        default_model = ModelService.ensure_default_model(db)
        return [default_model]
    return models


@router.post("/compare", response_model=ModelComparisonResponse)
def compare_models(req: ModelComparisonRequest, db: Session = Depends(get_db)):
    try:
        comparison = ModelService.compare_models(
            db,
            champion_id=req.champion_id,
            challenger_id=req.challenger_id,
            tolerance=req.tolerance
        )
        return comparison
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Model comparison failed: {str(e)}")


@router.post("/{model_id}/activate", response_model=ModelRegistrationResponse)
@router.patch("/{model_id}/activate", response_model=ModelRegistrationResponse)
def activate_model(model_id: str, db: Session = Depends(get_db)):
    try:
        model = ModelService.activate_model(db, model_id)
        return model
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Model activation failed: {str(e)}")


@router.get("/{model_id}/explainability", response_model=ModelExplainabilityResponse)
def get_model_explainability(model_id: str, db: Session = Depends(get_db)):
    try:
        explainability = ModelService.get_model_explainability(db, model_id)
        return explainability
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not compute explainability: {str(e)}")


@router.get("/{model_id}", response_model=ModelRegistrationResponse)
def get_model(model_id: str, db: Session = Depends(get_db)):
    model = ModelService.get_model_by_id(db, model_id)
    if not model:
        raise HTTPException(status_code=404, detail=f"Model with id '{model_id}' not found")
    return model


@router.post("/{model_id}/evaluate", response_model=ModelPredictionResponse)
def evaluate_model(model_id: str, req: ModelEvaluateRequest, db: Session = Depends(get_db)):
    model = ModelService.get_model_by_id(db, model_id)
    if not model:
        raise HTTPException(status_code=404, detail=f"Model with id '{model_id}' not found")

    try:
        pipeline = load_model_artifact(model.artifact_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not load model artifact: {str(e)}")

    if not req.records:
        raise HTTPException(status_code=400, detail="No records provided for evaluation")

    df_records = pd.DataFrame(req.records)
    preds = pipeline.predict(df_records)
    probs = pipeline.predict_proba(df_records)[:, 1] if hasattr(pipeline, "predict_proba") else [0.5] * len(preds)

    predictions = [
        {"pred": int(p), "prob": float(round(pr, 4))}
        for p, pr in zip(preds, probs)
    ]

    metrics = None
    if req.ground_truth is not None and len(req.ground_truth) == len(preds):
        metrics = evaluate_predictions(
            y_true=pd.Series(req.ground_truth).values,
            y_pred=preds,
            y_prob=probs
        )

    return ModelPredictionResponse(
        model_id=model.id,
        predictions=predictions,
        evaluation_metrics=metrics
    )
