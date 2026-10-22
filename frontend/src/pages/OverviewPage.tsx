import React from 'react';
import {
  Activity,
  Cpu,
  AlertTriangle,
  TrendingUp,
  ShieldCheck,
  ArrowRight,
  Info,
  Layers
} from 'lucide-react';
import { MetricCard } from '../components/MetricCard';
import { StatusBadge } from '../components/StatusBadge';
import type {
  ModelRegistration,
  DriftSummary,
  ModelQualityHistory,
  Experiment
} from '../types';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell
} from 'recharts';

interface OverviewPageProps {
  model: ModelRegistration | null;
  driftSummary: DriftSummary | null;
  qualityHistory: ModelQualityHistory | null;
  experiments: Experiment[];
  onNavigate: (tab: string) => void;
  onOpenReplay: () => void;
  onOpenExperiment: () => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  model,
  driftSummary,
  qualityHistory,
  experiments: _experiments,
  onNavigate,
  onOpenReplay,
  onOpenExperiment
}) => {
  const latestQuality = qualityHistory?.snapshots?.[0];

  const baselineF1 = model?.baseline_metrics?.primary_f1 ?? 0;
  const currentF1 = latestQuality?.f1_macro ?? baselineF1;
  const deltaF1 = currentF1 - baselineF1;

  // Prepare chart data for drift severity distribution
  const chartData = [
    { name: 'None', count: driftSummary?.status_distribution?.NONE || 0, color: '#10b981' },
    { name: 'Low', count: driftSummary?.status_distribution?.LOW || 0, color: '#3b82f6' },
    { name: 'Moderate', count: driftSummary?.status_distribution?.MEDIUM || 0, color: '#f59e0b' },
    { name: 'High', count: driftSummary?.status_distribution?.HIGH || 0, color: '#f43f5e' },
  ];

  return (
    <div className="space-y-6">
      {/* Critical Academic Methodology Notice */}
      <div className="glass-panel p-4 rounded-xl border-l-4 border-l-indigo-500 flex items-start gap-3 bg-indigo-950/20">
        <Info className="w-5 h-5 text-indigo-400 mt-0.5 shrink-0" />
        <div className="text-xs text-slate-300 leading-relaxed">
          <span className="font-semibold text-white">Academic Reliability Principle: </span>
          Input feature drift (covariate shift) does <span className="text-indigo-300 font-medium">not automatically imply predictive degradation</span>.
          DriftGuard calculates statistical tests (KS test with Benjamini–Hochberg FDR correction and Chi-square) alongside effect sizes (PSI and Wasserstein distance),
          and explicitly verifies predictive quality when delayed ground-truth labels arrive.
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Active Model Baseline"
          value={model ? `${model.name}` : 'No Model'}
          subtitle={`Algorithm: ${model?.algorithm || 'None'} | v${model?.version || '1.0'}`}
          icon={<Cpu className="w-5 h-5" />}
        />
        <MetricCard
          title="Analyzed Windows"
          value={driftSummary?.total_windows_analyzed ?? 0}
          subtitle={`Latest Status: ${driftSummary?.latest_window_status || 'NONE'}`}
          icon={<Activity className="w-5 h-5" />}
        />
        <MetricCard
          title="Active Drift Alerts"
          value={driftSummary?.active_alerts_count ?? 0}
          subtitle="Windows with Medium/High Shift"
          change={driftSummary?.active_alerts_count ? 'Attention Required' : 'Stable'}
          changeType={driftSummary?.active_alerts_count ? 'negative' : 'positive'}
          icon={<AlertTriangle className="w-5 h-5" />}
        />
        <MetricCard
          title="Current Model Macro-F1"
          value={currentF1.toFixed(3)}
          subtitle={`Baseline: ${baselineF1.toFixed(3)}`}
          change={`${deltaF1 >= 0 ? '+' : ''}${deltaF1.toFixed(3)} Δ`}
          changeType={deltaF1 < -0.05 ? 'negative' : deltaF1 > 0 ? 'positive' : 'neutral'}
          icon={<TrendingUp className="w-5 h-5" />}
        />
      </div>

      {/* Charts & Quick Action Center */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Drift Status Distribution */}
        <div className="glass-panel p-5 rounded-2xl col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">Monitoring Window Drift Severity</h3>
              <p className="text-xs text-slate-400">Distribution across all analyzed streaming batches</p>
            </div>
            <button
              onClick={() => onNavigate('drift')}
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition"
            >
              <span>Detailed Monitor</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#e2e8f0'
                  }}
                  formatter={(val: any) => [`${val} Windows`, 'Count']}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Launchpad & Status Card */}
        <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide mb-1">Reliability Sandbox</h3>
            <p className="text-xs text-slate-400 mb-4">
              Trigger controlled shift scenarios and evaluate retraining policies.
            </p>

            <div className="space-y-3">
              <button
                onClick={onOpenReplay}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 text-left transition group"
              >
                <div>
                  <div className="text-xs font-semibold text-white group-hover:text-indigo-300">
                    Replay Stream Batch
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Simulate mean, variance, or concept shift
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-400 transition" />
              </button>

              <button
                onClick={onOpenExperiment}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-indigo-950/40 hover:bg-indigo-900/40 border border-indigo-800/40 text-left transition group"
              >
                <div>
                  <div className="text-xs font-semibold text-indigo-200 group-hover:text-white">
                    Compare Retraining Policies
                  </div>
                  <div className="text-[11px] text-indigo-300/70">
                    Static vs Periodic vs Drift vs Gated
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-indigo-400 group-hover:text-white transition" />
              </button>

              <button
                onClick={() => onNavigate('quality')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 text-left transition group"
              >
                <div>
                  <div className="text-xs font-semibold text-white group-hover:text-emerald-300">
                    Delayed Label Evaluation
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Audit actual accuracy & confusion matrix
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-400 transition" />
              </button>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Model Health State:</span>
            <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              {qualityHistory?.current_status || 'HEALTHY'}
            </span>
          </div>
        </div>
      </div>

      {/* Recent Monitoring Windows Table */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">Recent Monitoring Windows</h3>
            <p className="text-xs text-slate-400">Live feed of statistical drift evaluation windows</p>
          </div>
          <button
            onClick={() => onNavigate('drift')}
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition"
          >
            View All ({driftSummary?.total_windows_analyzed ?? 0})
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800 font-mono uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-5 py-3">Window</th>
                <th className="px-5 py-3">Sample Size</th>
                <th className="px-5 py-3">Drift Status</th>
                <th className="px-5 py-3">Drifted Features</th>
                <th className="px-5 py-3">Mean PSI</th>
                <th className="px-5 py-3">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {driftSummary?.recent_windows && driftSummary.recent_windows.length > 0 ? (
                driftSummary.recent_windows.slice(0, 5).map((w) => (
                  <tr key={w.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-5 py-3.5 font-medium text-white flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5 text-indigo-400" />
                      {w.window_name}
                    </td>
                    <td className="px-5 py-3.5 font-mono">{w.sample_size} records</td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={w.overall_drift_status} size="sm" />
                    </td>
                    <td className="px-5 py-3.5 font-mono">
                      <span className={w.drifted_features_count > 0 ? 'text-amber-400 font-bold' : 'text-slate-400'}>
                        {w.drifted_features_count}
                      </span>{' '}
                      / {w.total_features_count}
                    </td>
                    <td className="px-5 py-3.5 font-mono">
                      <span className={w.overall_psi >= 0.25 ? 'text-rose-400 font-bold' : w.overall_psi >= 0.1 ? 'text-amber-400' : 'text-emerald-400'}>
                        {w.overall_psi.toFixed(4)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-400 font-mono">
                      {new Date(w.created_at).toLocaleTimeString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                    No monitoring windows recorded yet. Click "Replay Stream" to simulate live batches.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
