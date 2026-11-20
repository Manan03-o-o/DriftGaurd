# DriftGuard: ML Model Reliability Platform for Monitoring Data Drift and Evaluating Retraining Strategies

[![Tests](https://img.shields.io/badge/pytest-12%20passed-emerald)](backend/tests)
[![Python](https://img.shields.io/badge/python-3.11%20%7C%203.12%20%7C%203.13-blue)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-teal)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18+-indigo)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/license-MIT-gray)](LICENSE)


## 1. Project Overview

Machine learning models deployed in production inevitably experience **distribution shift** as real-world data distributions evolve over time. However, conventional monitoring systems frequently make a critical error: **they assume that input feature drift guarantees predictive degradation**.

**DriftGuard** addresses this problem by:
1. **Decoupling Input Drift from Model Degradation**: Feature drift ($P(X)$) is monitored using rigorous statistical tests and effect sizes, while predictive quality ($P(Y|X)$) is audited independently when delayed ground-truth labels arrive.
2. **Mitigating False Discoveries**: Applies the **Benjamini–Hochberg (FDR)** procedure across multiple feature hypothesis tests to prevent false-alarm cascades.
3. **Evaluating Four Retraining Policies**: Compares **Static**, **Periodic**, **Drift-Triggered**, and **Gated Retraining** over identical stream batches to determine the optimal trade-off between resilience and compute overhead.
4. **Providing a Full-Stack Dashboard**: Developer-tool interface (React, TypeScript, Vite, Tailwind CSS, Recharts) consuming live FastAPI endpoints.

---

## 2. System Architecture

```
driftguard/
├── frontend/               # React + TypeScript + Vite + Tailwind CSS dashboard
│   ├── src/
│   │   ├── components/     # Reusable UI components & modals
│   │   ├── pages/          # Overview, Models, Drift, Experiments, Quality, Docs
│   │   ├── services/       # Typed API client connecting to FastAPI
│   │   └── types/          # TypeScript interface definitions
│   └── vite.config.ts      # Vite configuration with proxy to backend
├── backend/                # FastAPI MLOps Backend
│   ├── app/
│   │   ├── api/            # REST API endpoints (/system, /models, /streams, etc.)
│   │   ├── core/           # Configuration and structured logging
│   │   ├── database/       # SQLAlchemy models and SQLite/PostgreSQL sessions
│   │   ├── ml/             # ML pipelines, drift detectors, policy engine
│   │   ├── schemas/        # Pydantic V2 data contracts
│   │   └── services/       # Business logic orchestrators
│   ├── tests/              # 12 automated unit and integration tests
│   └── requirements.txt    # Python package dependencies
├── data/                   # Realistic credit risk tabular dataset and documentation
├── experiments/            # Benchmark experiment configs and evaluation results
├── docs/                   # Architecture, API, Methodology, and Team breakdown
├── scripts/                # Automated Windows PowerShell setup & demo launcher
├── docker-compose.yml      # Multi-container production deployment
└── README.md
```

---

## 3. Key Technical Capabilities

### A. Statistical Drift Detection
- **Continuous Features**: Two-sample **Kolmogorov–Smirnov (KS)** test (`scipy.stats.ks_2samp`).
- **Multiple Testing Correction**: **Benjamini–Hochberg False Discovery Rate (FDR)** at $\alpha = 0.05$ prevents false positives when testing multiple continuous features.
- **Population Stability Index (PSI)**: Quantile-based decile binning on baseline with Laplace smoothing ($\epsilon = 10^{-4}$).
- **Normalized Wasserstein Distance**: Earth Mover's Distance normalized by baseline standard deviation ($\sigma$).
- **Categorical Features**: Pearson's $\chi^2$ goodness-of-fit and Total Variation Distance (TVD).
- **Online Stream Detector**: Adaptive Windowing (**ADWIN**) based on Hoeffding bounds.

### B. Controlled Shift Simulation
DriftGuard simulates 6 realistic stream scenarios with deterministic random seeds:
1. `no_shift`: Stationary reference distribution.
2. `mean_shift`: Continuous feature displacement (+DTI, -Credit Score).
3. `variance_shift`: Spread expansion ($2.2\times$ baseline standard deviation).
4. `categorical_shift`: Discrete frequency shifts (RENT increases to 80%).
5. `class_imbalance_shift`: Prior probability $P(Y=1)$ elevated to $>50\%$.
6. `concept_shift`: Underlying logit function changes (macroeconomic shock).

### C. Retraining Policy Benchmark
Benchmarks 4 adaptation strategies over identical replay streams:
1. **Static Model**: Zero updates (control benchmark).
2. **Periodic Retraining**: Fixed cadence updates (every $K$ windows).
3. **Drift-Triggered Retraining**: Updates upon statistical drift detection (PSI $\ge 0.20$).
4. **Gated Retraining**: Candidate trained upon drift, but deployed **only** if held-out validation Macro-F1 satisfies $F1_{cand} \ge F1_{active} - 0.02$. Rejects updates that degrade quality.

---

## 4. Windows Development Quickstart

### Prerequisites
- **Windows 10/11** x64
- **Python 3.10+** (Python 3.11, 3.12, 3.13 tested)
- **Node.js 18+** & **npm**

### Option A: Automated PowerShell Setup (Recommended)
Run the automated setup script in PowerShell:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\scripts\setup.ps1
```
This script will:
1. Verify Python, Node.js, and npm runtimes.
2. Create the Python virtual environment (`.venv`).
3. Install backend dependencies from `backend/requirements.txt`.
4. Install frontend npm packages.
5. Run the 12 pytest verification tests.

### Option B: Manual Setup

1. **Backend Setup**:
   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   python -m pip install --upgrade pip
   python -m pip install -r backend/requirements.txt
   ```

2. **Frontend Setup**:
   ```powershell
   cd frontend
   npm install
   cd ..
   ```

---

## 5. Running the Application

To ensure stability on Windows, start backend and frontend in separate terminals:

### Terminal 1: Backend API
```powershell
.\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
```
*Backend is accessible at: `http://localhost:8000` (Interactive API docs at `http://localhost:8000/docs`)*

### Terminal 2: Frontend Dashboard
```powershell
cd frontend
npm run dev
```
*Frontend is accessible at: `http://localhost:5173`*

### One-Click Demo Launcher
Alternatively, run the demo launcher script:
```powershell
.\scripts\run-demo.ps1
```

---

## 6. Running with Docker Compose

To run the complete platform using Docker:
```bash
docker compose up --build
```
- Dashboard: `http://localhost:5173`
- Backend API: `http://localhost:8000`

---

## 7. Running the Test Suite

Run the full backend test suite:
```powershell
.\.venv\Scripts\pytest.exe backend/tests -v
```

**Automated Test Coverage (12 tests):**
- `test_health_check` & `test_system_status`: Operational endpoints and database connectivity.
- `test_dataset_generation` & `test_baseline_training_prevent_leakage`: Scikit-learn pipelines and leakage prevention.
- `test_psi_identical_distributions` & `test_psi_shifted_distribution`: Population Stability Index validation.
- `test_no_shift_scenario_drift` & `test_mean_shift_scenario_drift`: Controlled shift detection accuracy.
- `test_benjamini_hochberg_correction`: Multiple-testing FDR control.
- `test_adwin_detector`: Streaming online detection.
- `test_retraining_policies_comparison`: Comparative 4-policy simulation.
- `test_models_flow`: End-to-end API integration from model registration to delayed labels.

---

