import os
from typing import List, Union
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")

    PROJECT_NAME: str = "DriftGuard"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # Database: Default SQLite for zero-setup local dev.
    DATABASE_URL: str = "sqlite:///./driftguard.db"
    
    # Storage paths
    ARTIFACTS_DIR: str = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "artifacts"))
    DATA_DIR: str = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "data"))
    EXPERIMENTS_DIR: str = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "experiments"))
    
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ]
    
    RANDOM_SEED: int = 42

    @field_validator("CORS_ORIGINS", mode="before")
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, list):
            return v
        return ["*"]


settings = Settings()

os.makedirs(settings.ARTIFACTS_DIR, exist_ok=True)
os.makedirs(settings.DATA_DIR, exist_ok=True)
os.makedirs(settings.EXPERIMENTS_DIR, exist_ok=True)
