from locust import HttpUser, task, between
import random

class DriftGuardUser(HttpUser):
    """
    Locust load testing benchmark for DriftGuard API endpoints.
    Simulates concurrent client requests for system status,
    model querying, drift analysis, and stream replays.
    
    Usage:
      pip install locust
      locust -f scripts/locustfile.py --host=http://localhost:8000
    """
    wait_time = between(0.5, 2.5)

    @task(4)
    def check_health(self):
        self.client.get("/health")

    @task(3)
    def check_system_status(self):
        self.client.get("/api/v1/system/status")

    @task(3)
    def get_models(self):
        self.client.get("/api/v1/models")

    @task(2)
    def get_drift_summary(self):
        self.client.get("/api/v1/monitoring/summary")

    @task(1)
    def simulate_replay_batch(self):
        payload = {
            "model_id": "default",
            "scenario": random.choice(["no_shift", "mean_shift", "concept_shift"]),
            "batch_size": 100,
            "total_batches": 1,
            "random_seed": random.randint(1, 9999),
            "auto_analyze_drift": True
        }
        self.client.post("/api/v1/streams/replay", json=payload)
