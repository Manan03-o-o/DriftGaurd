from pydantic import BaseModel, Field, ConfigDict
from typing import Dict, Any, List, Optional
from datetime import datetime


class AttachLabelsRequest(BaseModel):
    batch_id: str
    ground_truth_labels: List[int] = Field(description="List of binary true labels matching batch rows")


class ModelQualityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    model_id: str
    stream_id: Optional[str]
    batch_id: Optional[str]
    samples_count: int
    accuracy: float
    precision: float
    recall: float
    f1_macro: float
    roc_auc: Optional[float]
    pr_auc: Optional[float]
    confusion_matrix: List[List[int]]
    delta_f1_baseline: float
    created_at: datetime


class ModelQualityHistoryResponse(BaseModel):
    model_id: str
    baseline_metrics: Dict[str, Any]
    snapshots: List[ModelQualityResponse]
    current_status: str
