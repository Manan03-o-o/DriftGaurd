from pydantic import BaseModel, ConfigDict
from typing import Dict, Any, List, Optional
from datetime import datetime


class DataQualityAuditResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    model_id: str
    dataset_name: str
    records_count: int
    overall_score: float
    missing_values_count: int
    missing_percentage: float
    duplicate_rows_count: int
    outlier_count: int
    schema_valid: bool
    validation_errors: List[str]
    feature_scores: Dict[str, Any]
    created_at: datetime


class DataQualityAuditRequest(BaseModel):
    model_id: str
    dataset_name: Optional[str] = "credit_default"
    records: Optional[List[Dict[str, Any]]] = None
