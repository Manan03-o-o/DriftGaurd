from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime


class AlertResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    model_id: str
    window_id: Optional[str] = None
    stream_id: Optional[str] = None
    batch_id: Optional[str] = None
    severity: str
    title: str
    message: str
    affected_feature: Optional[str] = None
    metric_name: Optional[str] = None
    metric_value: Optional[float] = None
    threshold: Optional[float] = None
    recommended_action: str
    is_read: bool
    is_resolved: bool
    created_at: datetime


class AlertStatsResponse(BaseModel):
    total_alerts: int
    unresolved_alerts: int
    critical_alerts: int
    high_alerts: int
    medium_alerts: int
    low_alerts: int
    info_alerts: int
