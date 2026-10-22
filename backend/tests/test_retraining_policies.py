import pytest
from app.ml.data_generation import generate_credit_default_dataset
from app.ml.training import train_baseline_model
from app.ml.retraining import run_policy_comparison_experiment


def test_retraining_policies_comparison():
    df = generate_credit_default_dataset(n_samples=800, random_seed=42)
    pipeline, _, _ = train_baseline_model(
        df=df,
        target_col="default",
        algorithm="logistic_regression",
        random_seed=42
    )

    results = run_policy_comparison_experiment(
        baseline_df=df,
        initial_pipeline=pipeline,
        scenario="mean_shift",
        num_windows=3,
        window_size=150,
        periodic_interval=2,
        drift_psi_threshold=0.15,
        random_seed=42,
        target_col="default"
    )

    assert "policy_results" in results
    assert "static" in results["policy_results"]
    assert "periodic" in results["policy_results"]
    assert "drift_triggered" in results["policy_results"]
    assert "gated_retraining" in results["policy_results"]

    # Static should have 0 retrains
    assert results["policy_results"]["static"]["total_retrains"] == 0

    # Window records check
    static_records = results["policy_results"]["static"]["window_records"]
    assert len(static_records) == 3
    for r in static_records:
        assert r["model_version"] == "v1.0.0"
