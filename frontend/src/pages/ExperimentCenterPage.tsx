import React, { useState } from 'react';
import {
  FlaskConical,
  Play,
  RotateCcw,
  ShieldCheck
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import type { ModelRegistration, Experiment } from '../types';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts';

interface ExperimentCenterPageProps {
  models: ModelRegistration[];
  selectedModel: ModelRegistration | null;
  experiments: Experiment[];
  onRunExperiment: (params: {
    model_id: string;
    scenario: string;
    num_windows: number;
    window_size: number;
    periodic_interval: number;
    drift_psi_threshold: number;
    random_seed: number;
  }) => Promise<void>;
  isLoading: boolean;
}

export const ExperimentCenterPage: React.FC<ExperimentCenterPageProps> = ({
  models,
  selectedModel,
  experiments,
  onRunExperiment,
  isLoading
}) => {
  const [modelId, setModelId] = useState<string>(selectedModel?.id || (models[0]?.id ?? ''));
  const [scenario, setScenario] = useState<string>('mean_shift');
  const [numWindows, setNumWindows] = useState<number>(5);
  const [windowSize, setWindowSize] = useState<number>(200);
  const [periodicInterval, setPeriodicInterval] = useState<number>(2);
  const [driftPsiThreshold, setDriftPsiThreshold] = useState<number>(0.20);
  const [randomSeed, setRandomSeed] = useState<number>(42);

  const [selectedExperimentId, setSelectedExperimentId] = useState<string>(
    experiments.length > 0 ? experiments[0].id : ''
  );

  const activeExperiment =
    experiments.find((e) => e.id === selectedExperimentId) || experiments[0] || null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modelId) return;
    await onRunExperiment({
      model_id: modelId,
      scenario,
      num_windows: numWindows,
      window_size: windowSize,
      periodic_interval: periodicInterval,
      drift_psi_threshold: driftPsiThreshold,
      random_seed: randomSeed
    });
  };

  // Build Recharts data for policy F1 comparison over stream windows
  const chartData = React.useMemo(() => {
    if (!activeExperiment?.policy_comparison?.policy_results) return [];
    const results = activeExperiment.policy_comparison.policy_results;
    const staticRecs = results.static?.window_records || [];
    const periodicRecs = results.periodic?.window_records || [];
    const driftRecs = results.drift_triggered?.window_records || [];
    const gatedRecs = results.gated_retraining?.window_records || [];

    const data = [];
    const count = Math.max(staticRecs.length, periodicRecs.length, driftRecs.length, gatedRecs.length);

    for (let i = 0; i < count; i++) {
      data.push({
        window: `W${i + 1}`,
        static: staticRecs[i]?.f1_macro ?? null,
        periodic: periodicRecs[i]?.f1_macro ?? null,
        drift_triggered: driftRecs[i]?.f1_macro ?? null,
        gated_retraining: gatedRecs[i]?.f1_macro ?? null
      });
    }
    return data;
  }, [activeExperiment]);

  return (
    <div className="space-y-6">
      {/* Experiment Runner Controls Form */}
      <div className="glass-panel p-6 rounded-2xl border border-indigo-500/20 shadow-xl">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <FlaskConical className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">
                Configure Retraining Policy Experiment
              </h3>
              <p className="text-xs text-slate-400">
                Directly benchmarks 4 adaptation policies over an identical replay stream under controlled drift.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* Model Selector */}
            <div>
              <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block mb-1">
                Baseline Model
              </label>
              <select
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white outline-none"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.algorithm})
                  </option>
                ))}
              </select>
            </div>

            {/* Scenario Selector */}
            <div>
              <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block mb-1">
                Controlled Shift Scenario
              </label>
              <select
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-indigo-300 font-semibold outline-none"
              >
                <option value="no_shift">No Shift (Stationary Baseline)</option>
                <option value="mean_shift">Numerical Mean Shift (+DTI, -Credit)</option>
                <option value="variance_shift">Numerical Variance Expansion (2.2x)</option>
                <option value="categorical_shift">Categorical Shift (80% Rent)</option>
                <option value="class_imbalance_shift">Class Imbalance Shift (50%+ Default)</option>
                <option value="concept_shift">Concept Shift P(Y|X) Macro Shock</option>
              </select>
            </div>

            {/* Num Windows */}
            <div>
              <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block mb-1">
                Stream Windows ({numWindows})
              </label>
              <input
                type="range"
                min="2"
                max="10"
                value={numWindows}
                onChange={(e) => setNumWindows(parseInt(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>

            {/* Window Size */}
            <div>
              <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block mb-1">
                Window Batch Size ({windowSize})
              </label>
              <input
                type="range"
                min="50"
                max="500"
                step="50"
                value={windowSize}
                onChange={(e) => setWindowSize(parseInt(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>

            {/* Periodic Interval */}
            <div>
              <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block mb-1">
                Periodic Cadence (Every K)
              </label>
              <select
                value={periodicInterval}
                onChange={(e) => setPeriodicInterval(parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white outline-none"
              >
                <option value="1">Every 1 Window</option>
                <option value="2">Every 2 Windows</option>
                <option value="3">Every 3 Windows</option>
              </select>
            </div>

            {/* PSI Threshold */}
            <div>
              <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block mb-1">
                Drift Trigger PSI Threshold
              </label>
              <select
                value={driftPsiThreshold}
                onChange={(e) => setDriftPsiThreshold(parseFloat(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white outline-none"
              >
                <option value="0.10">0.10 (Sensitive)</option>
                <option value="0.20">0.20 (Standard Warning)</option>
                <option value="0.25">0.25 (Action Required)</option>
              </select>
            </div>

            {/* Seed */}
            <div>
              <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block mb-1">
                Deterministic Seed
              </label>
              <input
                type="number"
                value={randomSeed}
                onChange={(e) => setRandomSeed(parseInt(e.target.value) || 42)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white font-mono outline-none"
              />
            </div>

            {/* Run Button */}
            <div className="flex items-end">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RotateCcw className="w-4 h-4 animate-spin" />
                    <span>Executing Policies...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Run Policy Benchmark</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Historical Experiment Selector if multiple exist */}
      {experiments.length > 0 && (
        <div className="flex items-center gap-3 glass-panel p-3 rounded-xl overflow-x-auto text-xs">
          <span className="text-slate-400 font-mono text-[11px] uppercase tracking-wider shrink-0">
            Recorded Runs:
          </span>
          {experiments.map((exp) => (
            <button
              key={exp.id}
              onClick={() => setSelectedExperimentId(exp.id)}
              className={`px-3 py-1.5 rounded-lg font-mono text-[11px] whitespace-nowrap transition ${
                activeExperiment?.id === exp.id
                  ? 'bg-indigo-600 text-white font-semibold shadow'
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              {exp.title} ({exp.scenario})
            </button>
          ))}
        </div>
      )}

      {/* Active Experiment Results Presentation */}
      {activeExperiment ? (
        <div className="space-y-6">
          {/* Policy Performance Ranking Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {activeExperiment.policy_comparison.policy_rankings.map((rank, idx) => {
              const res = activeExperiment.policy_comparison.policy_results[rank.policy];
              return (
                <div
                  key={rank.policy}
                  className={`glass-panel p-5 rounded-2xl relative overflow-hidden ${
                    idx === 0 ? 'border-indigo-500/80 shadow-lg shadow-indigo-500/10' : ''
                  }`}
                >
                  {idx === 0 && (
                    <div className="absolute top-2 right-2 bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      RANK #1
                    </div>
                  )}
                  <span className="text-xs font-mono uppercase text-slate-400">
                    {rank.policy.replace(/_/g, ' ')}
                  </span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-white">{rank.avg_f1.toFixed(3)}</span>
                    <span className="text-xs text-slate-400">Avg F1</span>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-800/80 text-[11px] font-mono text-slate-400 space-y-1">
                    <div className="flex justify-between">
                      <span>Worst Window F1:</span>
                      <span className="text-slate-200">{res?.worst_window_f1?.toFixed(3)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Updates / Retrains:</span>
                      <span className="text-indigo-400 font-semibold">{rank.retrains}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Compute Duration:</span>
                      <span className="text-slate-300">{rank.compute_time.toFixed(2)}s</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Line Chart: Performance Over Time Across Policies */}
          <div className="glass-panel p-5 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-sm font-bold text-white tracking-wide">
                  F1-Score Trajectory Over Stream Windows
                </h4>
                <p className="text-xs text-slate-400">
                  Scenario: <span className="font-mono text-indigo-300">{activeExperiment.scenario}</span> | Seed: {activeExperiment.config.random_seed}
                </p>
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="window" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} domain={[0.3, 1.0]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Line
                    type="monotone"
                    dataKey="static"
                    name="Static (No Retrain)"
                    stroke="#94a3b8"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="periodic"
                    name="Periodic Retrain"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="drift_triggered"
                    name="Drift-Triggered"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="gated_retraining"
                    name="Gated Retraining"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Academic Insights Callout */}
          <div className="glass-panel p-5 rounded-2xl border-l-4 border-l-emerald-500 bg-emerald-950/10">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-1 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Academic Evaluation Insight
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              {activeExperiment.policy_comparison.academic_insights}
            </p>
          </div>

          {/* Decision Event Log for Gated Policy */}
          <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-white">Gated-Retraining Decision Audit Log</h4>
                <p className="text-xs text-slate-400">
                  Traceability of candidate model validations and gate admission checks
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800 text-[10px] uppercase">
                  <tr>
                    <th className="px-4 py-3">Window</th>
                    <th className="px-4 py-3">Active Version</th>
                    <th className="px-4 py-3">Drift Status</th>
                    <th className="px-4 py-3">Window Macro-F1</th>
                    <th className="px-4 py-3">Policy Action</th>
                    <th className="px-4 py-3">Reason / Validation Gate Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {activeExperiment.policy_comparison.policy_results.gated_retraining?.window_records.map(
                    (r) => (
                      <tr key={r.window_index} className="hover:bg-slate-800/30">
                        <td className="px-4 py-3 text-white font-semibold">W#{r.window_index + 1}</td>
                        <td className="px-4 py-3 text-indigo-400">{r.model_version}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={r.drift_status} size="sm" />
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-200">{r.f1_macro.toFixed(4)}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={r.decision} size="sm" />
                        </td>
                        <td className="px-4 py-3 text-slate-400 max-w-md truncate font-sans text-[11px]" title={r.reason}>
                          {r.reason}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-panel p-12 text-center rounded-2xl">
          <FlaskConical className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h4 className="text-base font-bold text-white">No Policy Experiments Executed</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            Choose a shift scenario and launch the benchmark to compare Static, Periodic, Drift-Triggered, and Gated Retraining.
          </p>
        </div>
      )}
    </div>
  );
};
