# DriftGuard Experimental Protocol & Reproducibility Guide

This protocol documents the exact procedure to reproduce the experimental benchmarks comparing model adaptation strategies under controlled distribution shifts.

---

## 1. Experimental Objectives

1. Evaluate statistical detector sensitivity and False Discovery Rate under stationary ($i.i.d.$) conditions.
2. Measure detector responsiveness when controlled shifts (mean, variance, categorical, class imbalance, concept shift) are injected into the stream.
3. Compare the resilience, runtime overhead, and performance trajectory of four model update policies:
   - **Static Model** (no updates)
   - **Periodic Retraining** (every $K$ windows)
   - **Drift-Triggered Retraining** (threshold $\text{PSI} \ge 0.20$)
   - **Gated Retraining** (candidate validation check: $\text{F1}_{\text{candidate}} \ge \text{F1}_{\text{active}} - 0.02$)

---

## 2. Experimental Environment & Seed Control

- **Operating System**: Windows 10/11 x64
- **Python**: 3.11 - 3.13
- **RNG Seed Control**: Experiments use deterministic pseudo-random seeds (`seed = 42`).
- **Stream Generation**: Batch $k$ seeds with `seed + k * 1337` to guarantee deterministic and identical stream sequences across all evaluated policies.

---

## 3. Dataset Specification

### Benchmark Tabular Credit Default (`credit_default.csv`)
- **Total Records**: 4,000 observations
- **Target Variable**: `default` (Binary: 0 = Solved, 1 = Default, ~20% base rate)
- **Features**:
  - `age` (Numerical): Applicant age [20 - 75]
  - `income` (Numerical): Annual income in USD [15,000 - 300,000]
  - `credit_score` (Numerical): FICO score [350 - 850]
  - `debt_to_income` (Numerical): Ratio of debt payments to income [0.05 - 0.75]
  - `loan_amount` (Numerical): Requested loan [1,000 - 50,000]
  - `employment_years` (Numerical): Employment duration [0 - 35]
  - `home_ownership` (Categorical): RENT, MORTGAGE, OWN, OTHER
  - `loan_purpose` (Categorical): DEBT_CONSOLIDATION, CREDIT_CARD, HOME_IMPROVEMENT, SMALL_BUSINESS, MAJOR_PURCHASE

---

## 4. Shift Injections

1. **Stationary Baseline (`no_shift`)**: Independent random resamples from baseline reference distribution.
2. **Mean Shift (`mean_shift`)**: Adds $+0.18$ to `debt_to_income`, subtracts $60$ from `credit_score`.
3. **Variance Shift (`variance_shift`)**: Expands feature deviations around baseline mean by $2.2\times$.
4. **Categorical Shift (`categorical_shift`)**: Shifts `home_ownership` so RENT comprises 80% of applicants.
5. **Class Imbalance Shift (`class_imbalance_shift`)**: Biases sampling to force default rate $>50\%$.
6. **Concept Shift (`concept_shift`)**: Shifts underlying logit intercept and weightings to simulate macroeconomic shock where previously safe borrowers default at elevated rates.

---

## 5. Execution Protocol

### Step 1: Ensure Clean Baseline Model
Execute via terminal or UI:
```bash
Invoke-RestMethod -Uri "http://localhost:8000/api/v1/models/train" -Method Post -ContentType "application/json" -Body '{"name":"CreditDefaultClassifier","version":"1.0.0","algorithm":"random_forest","dataset_name":"credit_default","n_samples":3500,"random_seed":42}'
```

### Step 2: Execute 4-Policy Benchmark
Run policy benchmark across 5 windows:
```bash
Invoke-RestMethod -Uri "http://localhost:8000/api/v1/policies/evaluate" -Method Post -ContentType "application/json" -Body '{"model_id":"default","scenario":"concept_shift","num_windows":5,"window_size":200,"periodic_interval":2,"drift_psi_threshold":0.20,"random_seed":42}'
```

### Step 3: Record and Inspect Trajectories
1. Open dashboard at `http://localhost:5173`.
2. Navigate to **Experiment Center**.
3. Inspect:
   - Average Macro-F1 by policy.
   - Total retrain events and compute duration.
   - Performance trajectory curve (Line Chart).
   - Gate audit log displaying accepted vs rejected candidate models.
