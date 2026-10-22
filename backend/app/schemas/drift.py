from pydantic import BaseModel, Field, ConfigDict
from typing import Dict, Any, List, Optional
from datetime import datetime


class DriftAnalysisRequest(BaseModel):
    model_id: str
    stream_id: Optional[str] = None
    batch_id: Optional[str] = None
    current_data: Optional[List[Dict[str, Any]]] = None
    window_name: str = Field(default="monitoring_window")
    alpha: float = Field(default=0.05, ge=0.001, le=0.20)


class MonitoringWindowResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    model_id: str
    stream_id: Optional[str]
    batch_id: Optional[str]
    window_name: str
    sample_size: int
    overall_drift_status: str
    overall_psi: float
    drifted_features_count: int
    total_features_count: int
    feature_results: Dict[str, Any]
    notes: Optional[str]
    created_at: datetime


class DriftSummaryResponse(BaseModel):
    total_windows_analyzed: int
    active_alerts_count: int
    latest_window_status: Optional[str]
    status_distribution: Dict[str, int]
    most_drifted_features: List[Dict[str, Any]]
    recent_windows: List[MonitoringWindowResponse]
