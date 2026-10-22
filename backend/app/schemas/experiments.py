from pydantic import BaseModel, Field, ConfigDict
from typing import Dict, Any, List, Optional
from datetime import datetime


class PolicyExperimentRequest(BaseModel):
    model_id: str
    scenario: str = Field(
        default="mean_shift",
        description="Scenario: no_shift, mean_shift, variance_shift, categorical_shift, class_imbalance_shift, concept_shift"
    )
    num_windows: int = Field(default=5, ge=2, le=15)
    window_size: int = Field(default=200, ge=50, le=1000)
    periodic_interval: int = Field(default=2, ge=1, le=5)
    drift_psi_threshold: float = Field(default=0.20, ge=0.05, le=0.80)
    random_seed: int = Field(default=42)


class ExperimentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    model_id: str
    scenario: str
    config: Dict[str, Any]
    policy_comparison: Dict[str, Any]
    status: str
    created_at: datetime
