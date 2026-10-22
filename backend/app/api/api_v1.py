from fastapi import APIRouter
from app.api.endpoints import system, models, streams, monitoring, labels, policies

api_router = APIRouter()

api_router.include_router(system.router, prefix="/system", tags=["System"])
api_router.include_router(models.router, prefix="/models", tags=["Models"])
api_router.include_router(streams.router, prefix="/streams", tags=["Streams"])
api_router.include_router(monitoring.router, prefix="/monitoring", tags=["Monitoring"])
api_router.include_router(labels.router, prefix="/labels", tags=["Labels & Quality"])
api_router.include_router(policies.router, prefix="/policies", tags=["Retraining Policies"])
