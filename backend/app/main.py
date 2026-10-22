import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.logging import setup_logging, logger
from app.database.session import init_db, SessionLocal
from app.services.model_service import ModelService
from app.api.api_v1 import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: configure logging, database, and baseline model
    setup_logging()
    logger.info("Initializing DriftGuard Database Schema...")
    init_db()

    db = SessionLocal()
    try:
        default_model = ModelService.ensure_default_model(db)
        logger.info(f"DriftGuard initialized with default baseline model: {default_model.name} ({default_model.id})")
    except Exception as e:
        logger.error(f"Error initializing default model: {e}", exc_info=True)
    finally:
        db.close()

    yield

    logger.info("DriftGuard backend shutting down gracefully.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="DriftGuard: ML Model Reliability Platform for Monitoring Data Drift and Evaluating Retraining Strategies",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Facilitates local student dev across localhost ports
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = f"{process_time:.4f}s"
    return response


@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "timestamp": time.time()
    }


# Include V1 Router
app.include_router(api_router, prefix=settings.API_V1_STR)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
