# DriftGuard: Team of Four Responsibilities & Defense Matrix

This document defines the technical division of labor, individual component ownership, and academic viva defense preparation for the team of four final-year B.Tech Computer Science students.

---

## Student 1: Machine Learning & Drift Detection Algorithms
**Primary Role:** ML Engineer / Statistical Analyst  
**Code Ownership:**
- `backend/app/ml/drift_detection.py`
- `backend/app/ml/data_generation.py`
- `backend/tests/test_drift_detection.py`

**Key Contributions:**
1. Formulated the two-sample Kolmogorov–Smirnov (KS) hypothesis testing pipeline for continuous feature streams.
2. Implemented the Benjamini–Hochberg (BH) False Discovery Rate (FDR) step-up correction algorithm to prevent false discovery inflation across multi-feature models.
3. Designed the decile-binned Population Stability Index (PSI) algorithm with Laplace smoothing for zero-count bins.
4. Implemented normalized Wasserstein distance and categorical Chi-Square tests.
5. Implemented the online Adaptive Windowing (ADWIN) detector based on Hoeffding bounds.

**Viva Defense Topics:**
- Why the Kolmogorov-Smirnov test is preferred over the t-test for arbitrary distributions.
- How the Benjamini–Hochberg procedure differs from the Bonferroni correction and why FDR is preferable in MLOps monitoring.
- The mathematical derivation of PSI and standard regulatory risk thresholds (< 0.10, 0.10–0.25, > 0.25).

---

## Student 2: Backend Architecture & MLOps Pipelines
**Primary Role:** Backend Engineer / Software Architect  
**Code Ownership:**
- `backend/app/api/` (all REST endpoints)
- `backend/app/database/` (SQLAlchemy models and session)
- `backend/app/ml/training.py`
- `backend/app/services/`
- `backend/tests/test_api_integration.py`

**Key Contributions:**
1. Architected the FastAPI backend with structured Pydantic V2 schemas and custom timing middleware.
2. Designed the SQLAlchemy database schema supporting zero-setup SQLite for local demonstration and seamless PostgreSQL migration.
3. Built scikit-learn preprocessing `Pipeline` and `ColumnTransformer` modules that strictly prevent data leakage across train/validation/test partitions.
4. Implemented model artifact persistence and dynamic deserialization using `joblib`.
5. Created pytest test suites with automated fixtures.

**Viva Defense Topics:**
- How data leakage is prevented during feature scaling and one-hot encoding.
- Database schema design for delayed labels and streaming batch relationships.
- Concurrency and async handling in FastAPI when executing CPU-bound scikit-learn tasks.

---

## Student 3: Retraining Policies & Evaluation Harness
**Primary Role:** Evaluation Specialist / MLOps Researcher  
**Code Ownership:**
- `backend/app/ml/retraining.py`
- `backend/app/ml/evaluation.py`
- `backend/tests/test_retraining_policies.py`
- `docs/experiment-protocol.md`
- `experiments/configs/`

**Key Contributions:**
1. Designed the reproducible comparative experiment harness for benchmarking 4 retraining policies (Static, Periodic, Drift-Triggered, Gated-Retraining).
2. Formulated the validation gating safety mechanism that discards candidate models if $F1_{cand} < F1_{curr} - 0.02$.
3. Engineered controlled synthetic shift scenarios (mean shift, variance expansion, categorical frequency shifts, class imbalance, and concept shift).
4. Implemented asynchronous delayed-label matching and delta degradation tracking ($\Delta F1$, confusion matrix).
5. Documented negative results where frequent unvalidated retraining degraded performance or incurred wasteful compute overhead.

**Viva Defense Topics:**
- Why retraining on drifted data can sometimes make the model worse (concept shift vs small sample overfitting).
- The difference between covariate shift and concept drift from an information-theoretic perspective.
- Temporal isolation in stream simulation: ensuring the training algorithm never accesses future labels.

---

## Student 4: Frontend Dashboard & Visualization Engineering
**Primary Role:** Full-Stack Frontend Engineer / UI Architect  
**Code Ownership:**
- `frontend/src/` (all React components, pages, services, types)
- `frontend/tailwind.config.js`, `frontend/src/index.css`
- `frontend/vite.config.ts`
- `scripts/setup.ps1`, `scripts/run-demo.ps1`

**Key Contributions:**
1. Developed the React + TypeScript + Vite dashboard with a dark navy/slate developer tool aesthetic.
2. Implemented responsive Recharts data visualizations for drift severity distributions, decile PSI rankings, and 4-policy performance curves over time.
3. Connected the frontend directly to live FastAPI endpoints with error notifications, loading states, and empty states.
4. Created modal interfaces for interactive stream replay, model training, and delayed ground-truth simulation.
5. Authored Windows PowerShell setup and demo runner automation scripts.

**Viva Defense Topics:**
- Component architecture and state management for real-time MLOps telemetry.
- Visualization choices: how Recharts line and bar charts represent statistical confidence and drift severity.
- How the UI clearly distinguishes between input covariate shift and actual model quality degradation.
