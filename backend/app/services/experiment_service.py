import json
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.database.models import Experiment, ModelRegistration
from app.schemas.experiments import PolicyExperimentRequest
from app.ml.data_generation import get_dataset
from app.ml.training import load_model_artifact
from app.ml.retraining import run_policy_comparison_experiment
from app.core.logging import logger


class ExperimentService:
    @staticmethod
    def run_experiment(db: Session, request: PolicyExperimentRequest) -> Experiment:
        model = db.query(ModelRegistration).filter(ModelRegistration.id == request.model_id).first()
        if not model:
            raise ValueError(f"Model {request.model_id} not found")

        baseline_df = get_dataset(dataset_name=model.dataset_name)
        target_col = model.feature_schema.get("target_col", "default")
        pipeline = load_model_artifact(model.artifact_path)

        logger.info(f"Running policy comparison experiment on model {model.name} with scenario {request.scenario}")
        
        comparison_res = run_policy_comparison_experiment(
            baseline_df=baseline_df,
            initial_pipeline=pipeline,
            scenario=request.scenario,
            num_windows=request.num_windows,
            window_size=request.window_size,
            periodic_interval=request.periodic_interval,
            drift_psi_threshold=request.drift_psi_threshold,
            random_seed=request.random_seed,
            target_col=target_col
        )

        experiment = Experiment(
            title=f"Policy-Eval-{request.scenario}-{request.num_windows}w",
            model_id=model.id,
            scenario=request.scenario,
            config={
                "num_windows": request.num_windows,
                "window_size": request.window_size,
                "periodic_interval": request.periodic_interval,
                "drift_psi_threshold": request.drift_psi_threshold,
                "random_seed": request.random_seed,
                "model_name": model.name,
                "dataset_name": model.dataset_name
            },
            policy_comparison=comparison_res,
            status="completed"
        )
        db.add(experiment)
        db.commit()
        db.refresh(experiment)
        return experiment

    @staticmethod
    def get_experiments(db: Session, skip: int = 0, limit: int = 20) -> List[Experiment]:
        return db.query(Experiment).order_by(Experiment.created_at.desc()).offset(skip).limit(limit).all()

    @staticmethod
    def get_experiment_by_id(db: Session, experiment_id: str) -> Optional[Experiment]:
        return db.query(Experiment).filter(Experiment.id == experiment_id).first()
