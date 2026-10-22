# DriftGuard System Architecture

## 1. Architectural Overview

DriftGuard is designed as a decoupled, multi-tiered full-stack ML reliability platform. It provides continuous monitoring of feature distributions, statistical hypothesis testing with multiple-testing correction, delayed ground-truth performance evaluation, and comparative evaluation of automated retraining policies.

```mermaid
graph TD
    Client[React + TypeScript + Vite Dashboard] -->|HTTP / REST JSON| FastAPIGateway[FastAPI Application Gateway]
    
    subgraph Backend Core
        FastAPIGateway --> Endpoints[API Endpoints]
        Endpoints --> ModelService[Model Service]
        Endpoints --> StreamService[Stream Replay Service]
        Endpoints --> DriftService[Drift Detection Service]
        Endpoints --> PolicyService[Experiment & Policy Service]
        
        ModelService --> SKLearnPipeline[Scikit-learn Pipelines & Preprocessing]
        StreamService --> ShiftEngine[Controlled Drift Simulation Engine]
        DriftService --> StatEngine[KS 2-Sample / BH-FDR / PSI / ADWIN]
        PolicyService --> RetrainEngine[Static / Periodic / Drift / Gated Engine]
    end

    subgraph Data & Storage
        Endpoints --> SQLAlchemyORM[SQLAlchemy ORM Layer]
        SQLAlchemyORM --> SQLite[(SQLite Local Dev / PostgreSQL)]
        SKLearnPipeline --> ArtifactStorage[Local File Artifacts (.joblib)]
    end
```

## 2. Component Subsystems

### 2.1 Backend Layer (FastAPI & Python 3.11+)
- **API Routers**: Modular endpoints grouped by domain (`/models`, `/streams`, `/monitoring`, `/labels`, `/policies`, `/system`).
- **Pydantic V2 Schemas**: Strict input validation, query validation, and serialization.
- **SQLAlchemy ORM**: Persistence for model registrations, inference batches, delayed labels, monitoring windows, and policy benchmark runs. Default is zero-setup SQLite (`driftguard.db`), easily reconfigurable to PostgreSQL via `DATABASE_URL`.
- **Pre-execution Pipelines**: Scikit-learn `Pipeline` and `ColumnTransformer` with `StandardScaler` and `OneHotEncoder`, fit strictly on train splits to prevent information leakage across validation/test splits.

### 2.2 Machine Learning & Drift Engine
- **Data Generator**: Generates realistic educational credit default data with known logistic log-odds ground truth, and supports controlled drift injections:
  - `no_shift`: Stationary reference distribution.
  - `mean_shift`: Controlled numerical mean shifts (+DTI, -Credit Score).
  - `variance_shift`: Numerical spread expansions (2.2x $\sigma$).
  - `categorical_shift`: Discrete frequency shifts (e.g. RENT spikes to 80%).
  - `class_imbalance_shift`: Prior probability shift $P(Y=1)$ elevated to >50%.
  - `concept_shift`: True conditional relationship $P(Y|X)$ shifts under macroeconomic shock.
- **Drift Detectors**:
  - Two-sample Kolmogorov-Smirnov test (`scipy.stats.ks_2samp`).
  - Benjamini–Hochberg False Discovery Rate (FDR) multiple-testing correction ($\alpha = 0.05$).
  - Population Stability Index (PSI) using quantile-based baseline deciles and Laplace smoothing.
  - Normalized Wasserstein distance (Earth Mover's Distance relative to $\sigma$).
  - Categorical Chi-Square goodness-of-fit and Total Variation Distance.
  - ADWIN (Adaptive Windowing) online streaming detector.

### 2.3 Retraining Policy Engine
Simulates and benchmarks 4 update policies over identical replay streams:
1. **Static Policy**: Zero updates; serves as the baseline degradation control.
2. **Periodic Policy**: Unconditional retraining every $K$ windows on accumulated recent data.
3. **Drift-Triggered Policy**: Automated retraining upon statistical drift detection (MEDIUM or HIGH severity / PSI $\ge 0.20$).
4. **Gated Retraining Policy**: Candidate model is trained upon drift signal but must pass an independent held-out validation gate ($F1_{candidate} \ge F1_{active} - 0.02$). Rejects models that degrade performance.

### 2.4 Frontend Dashboard (React + TypeScript + Vite + Tailwind CSS)
- Dark navy/slate theme developer tool aesthetic.
- Responsive Recharts visualizations for drift distribution, decile PSI rankings, and 4-policy trajectory curves.
- Interactive modal controls for stream replay, model training, and delayed label simulation.
- Real-time connection to live backend REST endpoints.
