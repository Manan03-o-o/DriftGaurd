from pydantic import BaseModel, Field, ConfigDict
from typing import Dict, Any, List, Optional
from datetime import datetime


class ModelTrainRequest(BaseModel):
    name: str = Field(default="CreditDefaultClassifier", description="Human readable model name")
    version: str = Field(default="1.0.0", description="Semantic model version")
    algorithm: str = Field(default="random_forest", description="Algorithm: random_forest, logistic_regression, hist_gradient_boosting")
    dataset_name: str = Field(default="credit_default", description="Dataset name: credit_default or breast_cancer")
    target_col: str = Field(default="default", description="Target column name")
    n_samples: int = Field(default=3500, ge=100, le=50000, description="Number of baseline samples")
    random_seed: int = Field(default=42, description="Deterministic seed for reproducibility")


class ModelRegistrationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    version: str
    algorithm: str
    task: str
    dataset_name: str
    feature_schema: Dict[str, Any]
    baseline_metrics: Dict[str, Any]
    artifact_path: str
    is_active: bool
    created_at: datetime


class ModelEvaluateRequest(BaseModel):
    records: List[Dict[str, Any]]
    ground_truth: Optional[List[int]] = None


class ModelPredictionResponse(BaseModel):
    model_id: str
    predictions: List[Dict[str, Any]]
    evaluation_metrics: Optional[Dict[str, Any]] = None


class FeatureImportanceItem(BaseModel):
    feature: str
    raw_feature: str
    importance: float
    percentage: float


class ModelExplainabilityResponse(BaseModel):
    model_id: str
    model_name: str
    version: str
    algorithm: str
    method: str
    feature_importances: List[FeatureImportanceItem]
    top_features: List[str]
    sample_prediction_explanation: Optional[Dict[str, Any]] = None
    educational_disclaimer: str


class ModelComparisonRequest(BaseModel):
    champion_id: str
    challenger_id: str
    tolerance: float = Field(default=0.02, ge=0.0, le=0.20, description="Acceptable degradation tolerance for candidate promotion")


class ModelComparisonResponse(BaseModel):
    champion: Dict[str, Any]
    challenger: Dict[str, Any]
    delta_metrics: Dict[str, Any]
    recommendation: str
    is_eligible_for_promotion: bool
    tolerance_applied: float
