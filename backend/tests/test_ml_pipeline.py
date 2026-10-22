import pytest
import numpy as np
import pandas as pd
from app.ml.data_generation import generate_credit_default_dataset, simulate_stream_batch
from app.ml.training import train_baseline_model, evaluate_predictions


def test_dataset_generation():
    df = generate_credit_default_dataset(n_samples=500, random_seed=42)
    assert len(df) == 500
    assert "default" in df.columns
    assert "credit_score" in df.columns
    assert "debt_to_income" in df.columns
    # Check default rate is bounded
    mean_default = df["default"].mean()
    assert 0.10 <= mean_default <= 0.35


def test_baseline_training_prevent_leakage():
    df = generate_credit_default_dataset(n_samples=600, random_seed=42)
    pipeline, schema, metrics = train_baseline_model(
        df=df,
        target_col="default",
        algorithm="random_forest",
        random_seed=42
    )
    
    assert pipeline is not None
    assert metrics["primary_f1"] > 0.50
    assert metrics["primary_accuracy"] > 0.65
    assert len(schema["numerical_features"]) > 0
    assert len(schema["categorical_features"]) > 0

    # Test single batch prediction
    X_test = df.drop(columns=["default"]).iloc[:10]
    preds = pipeline.predict(X_test)
    assert len(preds) == 10
    probs = pipeline.predict_proba(X_test)
    assert probs.shape == (10, 2)
