import React, { useState } from 'react';
import {
  HelpCircle,
  Clock,
  Activity
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import type { MonitoringWindow } from '../types';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell
} from 'recharts';

interface DriftMonitorPageProps {
  windows: MonitoringWindow[];
  onOpenReplayModal: () => void;
}

export const DriftMonitorPage: React.FC<DriftMonitorPageProps> = ({
  windows,
  onOpenReplayModal
}) => {
  const [selectedWindowId, setSelectedWindowId] = useState<string>(
    windows.length > 0 ? windows[0].id : ''
  );
  const [featureFilter, setFeatureFilter] = useState<'all' | 'drifted'>('all');

  const selectedWindow =
    windows.find((w) => w.id === selectedWindowId) || windows[0] || null;

  // Filter features if requested
  const featureEntries = selectedWindow
    ? Object.entries(selectedWindow.feature_results || {}).filter(([_, res]) => {
        if (featureFilter === 'drifted') return res.drift_detected;
        return true;
      })
    : [];

  // Prepare chart data: Top PSI features
  const psiChartData = selectedWindow
    ? Object.entries(selectedWindow.feature_results || {})
        .map(([name, res]) => ({
          name,
          psi: res.psi,
          drifted: res.drift_detected
        }))
        .sort((a, b) => b.psi - a.psi)
    : [];

  return (
    <div className="space-y-6">
      {/* Educational Banner */}
      <div className="glass-panel p-4 rounded-xl border border-indigo-500/30 bg-indigo-950/20 flex items-start gap-3">
        <HelpCircle className="w-5 h-5 text-indigo-400 mt-0.5 shrink-0" />
        <div className="text-xs text-slate-300 leading-relaxed">
          <span className="font-bold text-white">Statistical vs Practical Drift: </span>
          A low p-value indicates that distribution difference is unlikely due to random chance, but does not indicate severity.
          DriftGuard applies the <span className="text-indigo-300 font-mono">Benjamini–Hochberg procedure</span> to control the False Discovery Rate across multiple features,
          and pairs it with <span className="text-indigo-300 font-mono">PSI</span> and <span className="text-indigo-300 font-mono">Wasserstein Distance</span> before classifying a feature as actively drifted.
        </div>
      </div>

      {/* Window Selector & Actions Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-4 rounded-2xl">
        <div className="flex items-center gap-3">
          <Clock className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Monitoring Window:
          </span>
          <select
            value={selectedWindowId || (selectedWindow?.id ?? '')}
            onChange={(e) => setSelectedWindowId(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-white outline-none cursor-pointer"
          >
            {windows.map((w, idx) => (
              <option key={w.id} value={w.id}>
                #{idx + 1}: {w.window_name} ({w.overall_drift_status}) - {new Date(w.created_at).toLocaleTimeString()}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            <button
              onClick={() => setFeatureFilter('all')}
              className={`px-3 py-1 rounded-lg font-medium transition ${
                featureFilter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              All Features ({selectedWindow?.total_features_count ?? 0})
            </button>
            <button
              onClick={() => setFeatureFilter('drifted')}
              className={`px-3 py-1 rounded-lg font-medium transition ${
                featureFilter === 'drifted' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Drifted Only ({selectedWindow?.drifted_features_count ?? 0})
            </button>
          </div>

          <button
            onClick={onOpenReplayModal}
            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition"
          >
            Replay Another Batch
          </button>
        </div>
      </div>

      {selectedWindow ? (
        <>
          {/* Summary KPI Strip for Current Window */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass-panel p-4 rounded-xl">
              <span className="text-xs text-slate-400 font-mono">WINDOW DRIFT SEVERITY</span>
              <div className="mt-2">
                <StatusBadge status={selectedWindow.overall_drift_status} />
              </div>
            </div>
            <div className="glass-panel p-4 rounded-xl">
              <span className="text-xs text-slate-400 font-mono">SAMPLE SIZE</span>
              <p className="text-xl font-bold text-white mt-1">
                {selectedWindow.sample_size} <span className="text-xs font-normal text-slate-400">observations</span>
              </p>
            </div>
            <div className="glass-panel p-4 rounded-xl">
              <span className="text-xs text-slate-400 font-mono">MEAN / MAX PSI</span>
              <p className="text-xl font-bold text-white mt-1">
                {selectedWindow.overall_psi.toFixed(3)}
              </p>
            </div>
            <div className="glass-panel p-4 rounded-xl">
              <span className="text-xs text-slate-400 font-mono">DRIFTED FEATURES</span>
              <p className="text-xl font-bold text-amber-400 mt-1">
                {selectedWindow.drifted_features_count} / {selectedWindow.total_features_count}
              </p>
            </div>
          </div>

          {/* PSI Distribution Chart */}
          <div className="glass-panel p-5 rounded-2xl">
            <h4 className="text-sm font-bold text-white tracking-wide mb-1">
              Feature Population Stability Index (PSI) Ranking
            </h4>
            <p className="text-xs text-slate-400 mb-4">
              Thresholds: &lt; 0.10 Stable | 0.10 - 0.25 Moderate | &ge; 0.25 Significant Shift
            </p>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={psiChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                    formatter={(val: any) => [`PSI: ${val.toFixed(4)}`, 'Stability Score']}
                  />
                  <Bar dataKey="psi" radius={[4, 4, 0, 0]}>
                    {psiChartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.psi >= 0.25 ? '#f43f5e' : entry.psi >= 0.1 ? '#f59e0b' : '#10b981'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Per-Feature Drift Statistical Table */}
          <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800">
              <h4 className="text-sm font-bold text-white tracking-wide">
                Per-Feature Statistical Drift Diagnostics
              </h4>
              <p className="text-xs text-slate-400">
                Kolmogorov–Smirnov (continuous), Chi-square (categorical), BH adjusted q-values, and Wasserstein distance
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800 text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Feature</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Test</th>
                    <th className="px-4 py-3">Stat (KS / Chi2)</th>
                    <th className="px-4 py-3">Raw p-value</th>
                    <th className="px-4 py-3">BH q-value (FDR)</th>
                    <th className="px-4 py-3">PSI Score</th>
                    <th className="px-4 py-3">Effect Size (W-dist / TVD)</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {featureEntries.map(([featName, res]) => (
                    <tr
                      key={featName}
                      className={`hover:bg-slate-800/30 transition ${
                        res.drift_detected ? 'bg-amber-950/10' : ''
                      }`}
                    >
                      <td className="px-4 py-3 font-semibold text-white">{featName}</td>
                      <td className="px-4 py-3 text-slate-400 capitalize">{res.type}</td>
                      <td className="px-4 py-3 text-indigo-400 font-sans text-[11px]">
                        {res.test_type === 'kolmogorov_smirnov' ? 'KS 2-Sample' : 'Chi-Square'}
                      </td>
                      <td className="px-4 py-3">{res.statistic.toFixed(4)}</td>
                      <td className="px-4 py-3 text-slate-400">
                        {res.raw_p_value < 0.0001 ? '< 0.0001' : res.raw_p_value.toFixed(4)}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-300">
                        {res.bh_q_value !== undefined
                          ? res.bh_q_value < 0.0001
                            ? '< 0.0001'
                            : res.bh_q_value.toFixed(4)
                          : 'N/A'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`font-semibold ${
                            res.psi >= 0.25
                              ? 'text-rose-400'
                              : res.psi >= 0.1
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {res.psi.toFixed(4)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {res.type === 'numerical'
                          ? `${res.wasserstein_distance?.toFixed(2)} (${res.normalized_wasserstein?.toFixed(2)}σ)`
                          : `TVD: ${res.total_variation_distance?.toFixed(3)}`}
                      </td>
                      <td className="px-4 py-3">
                        {res.drift_detected ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-400 bg-rose-950/70 border border-rose-800/60 px-2 py-0.5 rounded-full">
                            DRIFT DETECTED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/50 border border-emerald-800/40 px-2 py-0.5 rounded-full">
                            STABLE
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="glass-panel p-12 text-center rounded-2xl">
          <Activity className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h4 className="text-base font-bold text-white">No Drift Monitoring Windows</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            Simulate a streaming batch of incoming predictions with controlled mean, variance, or concept shift
            to inspect drift detection.
          </p>
          <button
            onClick={onOpenReplayModal}
            className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20"
          >
            Replay First Stream Batch
          </button>
        </div>
      )}
    </div>
  );
};
