# DriftGuard REST API Specification

Base URL: `http://localhost:8000`  
API Prefix: `/api/v1`

---

## 1. System & Health

### `GET /health`
Returns service operational health.
```json
{
  "status": "healthy",
  "service": "DriftGuard",
  "version": "1.0.0",
  "timestamp": 1729615200.0
}
```

### `GET /api/v1/system/status`
Returns database connectivity, model registry count, analyzed window metrics, and runtime info.

---

## 2. Model Management

### `POST /api/v1/models/train`
Trains and registers a new baseline classification pipeline.
**Request Body:**
```json
{
  "name": "CreditDefaultClassifier",
  "version": "1.0.0",
  "algorithm": "random_forest",
  "dataset_name": "credit_default",
  "target_col": "default",
  "n_samples": 3500,
  "random_seed": 42
}
```
**Response:**
Returns `ModelRegistrationResponse` including ID, feature schema, and held-out validation metrics (`val_metrics`, `test_metrics`, `primary_f1`, `primary_accuracy`, `confusion_matrix`).

### `GET /api/v1/models`
Returns list of registered models in reverse chronological order.

### `GET /api/v1/models/{model_id}`
Returns details for a specific registered model.

### `POST /api/v1/models/{model_id}/evaluate`
Performs ad-hoc inference on input records.

---

## 3. Stream Replay & Drift Simulation

### `POST /api/v1/streams/replay`
Simulates a stream of batches under a chosen controlled shift scenario.
**Request Body:**
```json
{
  "model_id": "default",
  "scenario": "mean_shift",
  "batch_size": 200,
  "total_batches": 5,
  "random_seed": 42,
  "auto_analyze_drift": true
}
```
**Supported Scenarios:**
- `no_shift`: Stationary baseline.
- `mean_shift`: Continuous feature mean displacement.
- `variance_shift`: Continuous feature spread expansion (2.2x).
- `categorical_shift`: Discrete frequency shifts.
- `class_imbalance_shift`: Prior probability shift (>50% positive rate).
- `concept_shift`: True relationship $P(Y|X)$ changes under macroeconomic shock.

### `GET /api/v1/streams/{stream_id}`
Returns details and prediction batch records for a stream session.

---

## 4. Drift Monitoring

### `POST /api/v1/monitoring/analyze`
Executes statistical hypothesis testing and effect size calculations between baseline and a current monitoring window.
**Response:** Returns `MonitoringWindowResponse` with per-feature KS statistic, raw p-value, Benjamini-Hochberg FDR corrected q-value, PSI score, Wasserstein distance, and overall severity (`NONE`, `LOW`, `MEDIUM`, `HIGH`).

### `GET /api/v1/monitoring/summary`
Returns aggregated drift status counts, most drifted features ranking, and recent windows.

### `GET /api/v1/monitoring/history`
Returns historical monitoring windows with query filtering.

---

## 5. Delayed Labels & Predictive Quality

### `POST /api/v1/labels`
Attaches delayed ground-truth outcome labels to previously recorded prediction batches and evaluates empirical degradation.
**Request Body:**
```json
{
  "batch_id": "<batch_uuid>",
  "ground_truth_labels": [0, 1, 0, 0, 1, ...]
}
```
**Response:** Returns `ModelQualityResponse` with Accuracy, Precision, Recall, Macro-F1, ROC-AUC, Confusion Matrix, and $\Delta F1$ relative to baseline.

### `GET /api/v1/labels/models/{model_id}/quality`
Returns historical quality trajectory and degradation status (`HEALTHY`, `DEGRADED`, `CRITICALLY_DEGRADED`).

---

## 6. Retraining Policy Benchmarks

### `POST /api/v1/policies/evaluate`
Executes a comparative benchmark comparing 4 retraining strategies over an identical stream.
**Request Body:**
```json
{
  "model_id": "<model_uuid>",
  "scenario": "concept_shift",
  "num_windows": 5,
  "window_size": 200,
  "periodic_interval": 2,
  "drift_psi_threshold": 0.20,
  "random_seed": 42
}
```
**Response:** Returns policy rankings, window-by-window performance records, compute durations, and decision audit logs (RETRAINED, GATED_ACCEPTED, GATED_REJECTED, STATIC_PRESERVED).
