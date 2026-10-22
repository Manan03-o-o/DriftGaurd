import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database.session import init_db

client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def setup_database():
    init_db()


def test_models_flow():
    # 1. Train model
    payload = {
        "name": "Integration-Test-Model",
        "version": "1.0.0",
        "algorithm": "logistic_regression",
        "dataset_name": "credit_default",
        "target_col": "default",
        "n_samples": 600,
        "random_seed": 42
    }
    res = client.post("/api/v1/models/train", json=payload)
    assert res.status_code == 200
    model = res.json()
    model_id = model["id"]
    assert model_id is not None
    assert "baseline_metrics" in model

    # 2. Replay stream
    stream_payload = {
        "model_id": model_id,
        "scenario": "no_shift",
        "batch_size": 50,
        "total_batches": 2,
        "random_seed": 42,
        "auto_analyze_drift": True
    }
    s_res = client.post("/api/v1/streams/replay", json=stream_payload)
    assert s_res.status_code == 200
    stream_data = s_res.json()
    assert len(stream_data["batches"]) == 2
    batch_id = stream_data["batches"][0]["id"]

    # 3. Drift summary check
    d_res = client.get("/api/v1/monitoring/summary")
    assert d_res.status_code == 200
    summary = d_res.json()
    assert summary["total_windows_analyzed"] >= 2

    # 4. Attach ground truth labels
    labels_payload = {
        "batch_id": batch_id,
        "ground_truth_labels": [0] * 25 + [1] * 25
    }
    l_res = client.post("/api/v1/labels", json=labels_payload)
    assert l_res.status_code == 200
    quality = l_res.json()
    assert "f1_macro" in quality
    assert quality["samples_count"] == 50

    # 5. Check quality history
    q_res = client.get(f"/api/v1/labels/models/{model_id}/quality")
    assert q_res.status_code == 200
    q_data = q_res.json()
    assert len(q_data["snapshots"]) >= 1

    # 6. Policy evaluate
    policy_payload = {
        "model_id": model_id,
        "scenario": "mean_shift",
        "num_windows": 2,
        "window_size": 50,
        "periodic_interval": 1,
        "drift_psi_threshold": 0.20,
        "random_seed": 42
    }
    p_res = client.post("/api/v1/policies/evaluate", json=policy_payload)
    assert p_res.status_code == 200
    exp = p_res.json()
    assert "policy_comparison" in exp
