import numpy as np
import pandas as pd
from app.ml.data_generation import generate_credit_default_dataset, simulate_stream_batch
from app.ml.drift_detection import (
    calculate_psi,
    detect_window_drift,
    benjamini_hochberg_correction,
    ADWINDetector
)


def test_psi_identical_distributions():
    rng = np.random.RandomState(42)
    base = rng.normal(100, 15, size=1000)
    curr = rng.normal(100, 15, size=1000)
    psi = calculate_psi(base, curr)
    # Identical distribution PSI should be small (< 0.10)
    assert psi < 0.10


def test_psi_shifted_distribution():
    rng = np.random.RandomState(42)
    base = rng.normal(100, 15, size=1000)
    curr = rng.normal(130, 15, size=1000)  # 2.0 std shift
    psi = calculate_psi(base, curr)
    # Significant shift PSI should be >= 0.25
    assert psi >= 0.25


def test_no_shift_scenario_drift():
    df = generate_credit_default_dataset(n_samples=1000, random_seed=42)
    X_base = df.drop(columns=["default"])
    
    X_curr, _ = simulate_stream_batch(
        reference_df=df,
        batch_size=300,
        scenario="no_shift",
        batch_index=0,
        random_seed=101
    )

    res = detect_window_drift(
        baseline_df=X_base,
        current_df=X_curr
    )

    # In no-shift, drift status should be NONE or LOW
    assert res["overall_drift_status"] in ["NONE", "LOW"]
    assert res["drifted_features_count"] <= 1


def test_mean_shift_scenario_drift():
    df = generate_credit_default_dataset(n_samples=1000, random_seed=42)
    X_base = df.drop(columns=["default"])
    
    X_curr, _ = simulate_stream_batch(
        reference_df=df,
        batch_size=300,
        scenario="mean_shift",
        batch_index=0,
        random_seed=42
    )

    res = detect_window_drift(
        baseline_df=X_base,
        current_df=X_curr
    )

    # Mean shift should detect drift on debt_to_income or credit_score
    assert res["drifted_features_count"] >= 1
    assert res["overall_drift_status"] in ["LOW", "MEDIUM", "HIGH"]
    assert res["feature_results"]["debt_to_income"]["is_statistically_significant"] is True


def test_benjamini_hochberg_correction():
    p_vals = [0.001, 0.008, 0.035, 0.045, 0.45, 0.85]
    res = benjamini_hochberg_correction(p_vals, alpha=0.05)
    assert len(res) == len(p_vals)
    # The smallest p-value should remain significant
    assert res[0]["is_significant"] is True
    # The large p-values should be non-significant
    assert res[4]["is_significant"] is False


def test_adwin_detector():
    detector = ADWINDetector(delta=0.01)
    drift_detected = False
    rng = np.random.RandomState(42)

    # Feed stationary values
    for _ in range(50):
        val = rng.normal(0.0, 0.1)
        detector.update(val)

    # Feed shifted values
    for _ in range(50):
        val = rng.normal(2.0, 0.1)
        if detector.update(val):
            drift_detected = True
            break

    assert drift_detected is True
