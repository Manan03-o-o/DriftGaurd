import React, { useState } from 'react';
import {
  Activity,
  Cpu,
  AlertTriangle,
  TrendingUp,
  ShieldCheck,
  ArrowRight,
  Info,
  Layers,
  Calendar,
  PlusCircle,
  Database
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
  models?: ModelRegistration[];
  selectedModelId?: string;
  onSelectModel?: (id: string) => void;
  driftSummary: DriftSummary | null;
  qualityHistory: ModelQualityHistory | null;
  experiments: Experiment[];
  onNavigate: (tab: string) => void;
  onOpenReplay: () => void;
  onOpenExperiment: () => void;
  onOpenTrainModal?: () => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  model,
  models = [],
  selectedModelId,
  onSelectModel,
  driftSummary,
  qualityHistory,
  experiments = [],
  onNavigate,
  onOpenReplay,
  onOpenExperiment,
  onOpenTrainModal
}) => {
  const [timeRange, setTimeRange] = useState<'all' | '24h' | '7d' | '30d'>('all');

  const latestQuality = qualityHistory?.snapshots?.[0];
  const baselineF1 = model?.baseline_metrics?.primary_f1 ?? 0;
  const currentF1 = latestQuality?.f1_macro ?? baselineF1;
  const deltaF1 = currentF1 - baselineF1;

  // Filter windows based on time range
  const allWindows = driftSummary?.recent_windows || [];
  const filteredWindows = React.useMemo(() => {
    if (timeRange === 'all') return allWindows;
    const now = new Date().getTime();
    const rangeMs =
      timeRange === '24h'
        ? 24 * 60 * 60 * 1000
        : timeRange === '7d'
        ? 7 * 24 * 60 * 60 * 1000
        : 30 * 24 * 60 * 60 * 1000;
    return allWindows.filter((w) => now - new Date(w.created_at).getTime() <= rangeMs);
  }, [allWindows, timeRange]);

  // Status counts for filtered range
  const statusCounts = React.useMemo(() => {
    const counts = { NONE: 0, LOW: 0, MEDIUM: 0, HIGH: 0 };
    filteredWindows.forEach((w) => {
      const s = (w.overall_drift_status || 'NONE') as keyof typeof counts;
      if (counts[s] !== undefined) counts[s]++;
    });
    return counts;
  }, [filteredWindows]);

  const chartData = [
    { name: 'None', count: statusCounts.NONE, color: '#10b981' },
    { name: 'Low', count: statusCounts.LOW, color: '#3b82f6' },
    { name: 'Moderate', count: statusCounts.MEDIUM, color: '#f59e0b' },
    { name: 'High', count: statusCounts.HIGH, color: '#f43f5e' },
  ];

  // Total retraining events
  const totalRetrains = experiments.reduce((acc, exp) => {
    const gated = exp.policy_comparison?.policy_results?.gated_retraining?.total_retrains || 0;
    const drift = exp.policy_comparison?.policy_results?.drift_triggered?.total_retrains || 0;
    return acc + gated + drift;
  }, 0);

  // Active models count
  const activeModelsCount = models.filter((m) => m.is_active).length;

  if (!model && models.length === 0) {
    return (
      <div className="glass-panel p-12 rounded-2xl text-center space-y-4 max-w-lg mx-auto mt-12 border border-slate-800">
        <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center mx-auto border border-indigo-500/30">
          <Cpu className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-white">No Machine Learning Models Registered</h3>
        <p className="text-xs text-slate-400">
          Initialize DriftGuard by training a baseline credit default classifier or scikit-learn pipeline.
        </p>
        {onOpenTrainModal && (
          <button
            onClick={onOpenTrainModal}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition flex items-center gap-2 mx-auto"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Train First Baseline Model</span>
          </button>
        )}
      </div>
    );
  }

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

      {/* Filter and Date-Range Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 glass-panel p-3.5 rounded-2xl">
        <div className="flex items-center gap-3">
          {models.length > 0 && onSelectModel && (
            <div className="flex items-center gap-2 text-xs">
              <Database className="w-4 h-4 text-indigo-400" />
              <span className="text-slate-400 font-medium">Scope Model:</span>
              <select
                value={selectedModelId || model?.id || ''}
                onChange={(e) => onSelectModel(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 outline-none cursor-pointer"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} (v{m.version}) {m.is_active ? '★ Active Champion' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="text-slate-400 font-medium">Date Range:</span>
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800">
            {(['all', '24h', '7d', '30d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold uppercase transition ${
                  timeRange === range
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Active Model Baseline"
          value={model ? `${model.name}` : 'No Model'}
          subtitle={`Algorithm: ${model?.algorithm || 'None'} | v${model?.version || '1.0'}`}
          change={`${activeModelsCount} Active / ${models.length} Total`}
          changeType="positive"
          icon={<Cpu className="w-5 h-5" />}
        />
        <MetricCard
          title="Analyzed Windows"
          value={filteredWindows.length}
          subtitle={`Latest Status: ${driftSummary?.latest_window_status || 'NONE'}`}
          change={timeRange === 'all' ? 'All recorded history' : `Filtered to ${timeRange}`}
          changeType="neutral"
          icon={<Activity className="w-5 h-5" />}
        />
        <MetricCard
          title="Active Drift Alerts"
          value={statusCounts.MEDIUM + statusCounts.HIGH}
          subtitle="Windows with Medium/High Shift"
          change={statusCounts.MEDIUM + statusCounts.HIGH > 0 ? 'Attention Required' : 'Stable'}
          changeType={statusCounts.MEDIUM + statusCounts.HIGH > 0 ? 'negative' : 'positive'}
          icon={<AlertTriangle className="w-5 h-5" />}
        />
        <MetricCard
          title="Current Model Macro-F1"
          value={currentF1.toFixed(3)}
          subtitle={`Baseline: ${baselineF1.toFixed(3)} | Retrains: ${totalRetrains}`}
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
              <p className="text-xs text-slate-400">Distribution across analyzed streaming batches ({timeRange})</p>
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
            View All ({filteredWindows.length})
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
              {filteredWindows.length > 0 ? (
                filteredWindows.slice(0, 5).map((w) => (
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
                    No monitoring windows found for this filter. Click "Replay Stream" to simulate live batches.
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