from pydantic import BaseModel
from typing import Dict, Any

class SystemStatusResponse(BaseModel):
    status: str
    version: str
    environment: str
    database_status: str
    registered_models_count: int
    analyzed_windows_count: int
    total_experiments_count: int
    system_time: str
    details: Dict[str, Any]
