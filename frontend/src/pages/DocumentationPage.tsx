import React from 'react';
import { Shield, Activity, FlaskConical, Users } from 'lucide-react';

export const DocumentationPage: React.FC = () => {
  return (
    <div className="space-y-8 max-w-5xl">
      {/* Intro Header */}
      <div>
        <h3 className="text-xl font-bold text-white tracking-tight">DriftGuard Architecture & Scientific Methodology</h3>
        <p className="text-xs text-slate-400 mt-1">
          Final-year B.Tech Capstone Project documentation for faculty demonstration and technical defense.
        </p>
      </div>

      {/* 1. Core Principle */}
      <div className="glass-panel p-6 rounded-2xl border-l-4 border-l-indigo-500">
        <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
          <Shield className="w-4 h-4 text-indigo-400" />
          Core Research Proposition: Separation of Input Drift from Degradation
        </h4>
        <p className="text-xs text-slate-300 leading-relaxed font-sans">
          A fundamental error in naive MLOps architectures is treating every statistical covariate shift as proof of model failure.
          If a model's prediction depends primarily on credit score and debt-to-income, substantial drift in an unweighted or low-importance feature
          will register high statistical divergence while true classification accuracy remains untouched.
          Conversely, <span className="text-indigo-300 font-semibold">concept drift</span> (where the underlying relationship P(Y|X) shifts) can degrade accuracy even when feature distributions P(X) appear identical.
          DriftGuard explicitly decouples feature distribution monitoring from ground-truth predictive quality audits.
        </p>
      </div>

      {/* 2. Statistical Drift Detectors */}
      <div className="glass-panel p-6 rounded-2xl space-y-4">
        <h4 className="text-sm font-bold text-white flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          Drift Detection Mathematical Framework
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <h5 className="font-bold text-indigo-300 mb-1">Two-Sample Kolmogorov–Smirnov (KS) Test</h5>
            <p className="text-slate-400 leading-relaxed">
              Non-parametric test evaluating if empirical cumulative distributions F1(x) and F2(x) differ significantly:
            </p>
            <div className="my-2 p-2 rounded bg-slate-950 font-mono text-[11px] text-cyan-300 text-center">
              D = sup_x |F1(x) - F2(x)|
            </div>
            <p className="text-slate-400">
              <span className="font-semibold text-slate-200">FDR Correction: </span> To prevent false positives when testing multiple features simultaneously, DriftGuard applies the <span className="text-indigo-300 font-mono">Benjamini–Hochberg</span> procedure at alpha = 0.05.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <h5 className="font-bold text-indigo-300 mb-1">Population Stability Index (PSI)</h5>
            <p className="text-slate-400 leading-relaxed">
              Information-theoretic metric measuring shift across decile bins established on the baseline:
            </p>
            <div className="my-2 p-2 rounded bg-slate-950 font-mono text-[11px] text-cyan-300 text-center">
              PSI = &Sigma; (Actual% - Expected%) &times; ln(Actual% / Expected%)
            </div>
            <p className="text-slate-400">
              Laplace smoothing (epsilon = 1e-4) is applied to prevent division-by-zero or ln(0) on zero-count monitoring bins.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <h5 className="font-bold text-indigo-300 mb-1">Wasserstein Distance (Earth Mover's Distance)</h5>
            <p className="text-slate-400 leading-relaxed">
              Calculates the minimum work required to transform one 1D distribution into the other. DriftGuard normalizes Wasserstein distance by baseline standard deviation (&sigma;) to provide an interpretable effect size.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <h5 className="font-bold text-indigo-300 mb-1">Categorical Chi-Square & Total Variation</h5>
            <p className="text-slate-400 leading-relaxed">
              Calculates Pearson goodness-of-fit &chi;&sup2; against baseline category frequencies alongside Total Variation Distance (TVD) for discrete features such as home ownership and loan purpose.
            </p>
          </div>
        </div>
      </div>

      {/* 3. Retraining Policies */}
      <div className="glass-panel p-6 rounded-2xl space-y-4">
        <h4 className="text-sm font-bold text-white flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-violet-400" />
          The Four Evaluated Retraining Policies
        </h4>

        <div className="space-y-3 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3">
            <span className="font-mono font-bold text-indigo-400 w-32 shrink-0">1. Static Policy:</span>
            <span className="text-slate-300">
              The model is never retrained after initial deployment. Serves as the negative control benchmark to quantify degradation over time under covariate and concept shifts.
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3">
            <span className="font-mono font-bold text-blue-400 w-32 shrink-0">2. Periodic Policy:</span>
            <span className="text-slate-300">
              Retrains blindly at fixed time intervals (e.g. every K windows) regardless of whether distribution shift occurred. Incurs constant compute overhead and risks overfitting small recent windows.
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3">
            <span className="font-mono font-bold text-amber-400 w-32 shrink-0">3. Drift-Triggered:</span>
            <span className="text-slate-300">
              Retrains only when drift severity reaches MEDIUM or HIGH (PSI &ge; 0.20 or significant KS test). Saves compute during stationary periods, but automatically deploys the candidate without quality checks.
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3">
            <span className="font-mono font-bold text-emerald-400 w-32 shrink-0">4. Gated Retraining:</span>
            <span className="text-slate-300">
              Drift triggers candidate retraining, but the new candidate must pass an independent validation gate (Candidate F1 &ge; Active F1 - 0.02). If the candidate fails the gate, it is rejected, preserving the robust current model and preventing degraded deployments.
            </span>
          </div>
        </div>
      </div>

      {/* 4. Team of Four Responsibility Matrix */}
      <div className="glass-panel p-6 rounded-2xl space-y-4">
        <h4 className="text-sm font-bold text-white flex items-center gap-2">
          <Users className="w-4 h-4 text-emerald-400" />
          Academic Capstone: Team-of-Four Responsibilities
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="font-mono text-indigo-400 font-bold block mb-1">Student 1: ML & Drift Algorithms</span>
            <p className="text-slate-400">
              Formulated KS 2-sample test, Benjamini-Hochberg FDR procedure, Population Stability Index, ADWIN online detector, and synthetic shift generator.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="font-mono text-cyan-400 font-bold block mb-1">Student 2: Backend & MLOps Architecture</span>
            <p className="text-slate-400">
              Engineered FastAPI REST endpoints, SQLAlchemy ORM schema, scikit-learn pipelines with leakage prevention, and model artifact serialization.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="font-mono text-emerald-400 font-bold block mb-1">Student 3: Retraining Policies & Evaluation</span>
            <p className="text-slate-400">
              Designed comparative simulation harness for 4 retraining strategies, validation gating mechanisms, and delayed label performance tracking.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="font-mono text-violet-400 font-bold block mb-1">Student 4: Frontend Dashboard & Visualization</span>
            <p className="text-slate-400">
              Built React/TypeScript/Vite dashboard, Recharts interactive performance trajectories, drift distribution diagnostics, and faculty presentation workflows.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
