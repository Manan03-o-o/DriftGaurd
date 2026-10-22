from pydantic import BaseModel, Field, ConfigDict
from typing import Dict, Any, List, Optional
from datetime import datetime


class StreamReplayRequest(BaseModel):
    model_id: str
    scenario: str = Field(
        default="no_shift",
        description="Scenario: no_shift, mean_shift, variance_shift, categorical_shift, class_imbalance_shift, concept_shift"
    )
    batch_size: int = Field(default=200, ge=20, le=2000)
    total_batches: int = Field(default=5, ge=1, le=20)
    random_seed: int = Field(default=42)
    auto_analyze_drift: bool = Field(default=True)


class PredictionBatchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    batch_index: int
    records_count: int
    has_labels: bool
    created_at: datetime
    predictions_preview: List[Dict[str, Any]]


class StreamSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    model_id: str
    dataset_name: str
    scenario: str
    batch_size: int
    total_batches: int
    created_at: datetime
    batches: List[PredictionBatchResponse]
