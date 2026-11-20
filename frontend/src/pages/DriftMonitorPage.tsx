import React, { useState } from 'react';
import {
  Clock,
  Activity,
  Sliders,
  BarChart2,
  Info,
  Flame,
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
  Legend,
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
  const [selectedFeatureForComparison, setSelectedFeatureForComparison] = useState<string | null>(null);

  // Dynamic threshold testing
  const [customPsiThreshold, setCustomPsiThreshold] = useState<number>(0.20);
  const [customAlpha, setCustomAlpha] = useState<number>(0.05);

  const selectedWindow =
    windows.find((w) => w.id === selectedWindowId) || windows[0] || null;

  // Track repeatedly drifting features across all windows
  const featureRepeatDriftCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    windows.forEach((w) => {
      if (w.feature_results) {
        Object.entries(w.feature_results).forEach(([feat, res]) => {
          if (res.drift_detected || res.psi >= 0.20) {
            counts[feat] = (counts[feat] || 0) + 1;
          }
        });
      }
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [windows]);

  // Set initial selected feature for distribution inspection
  React.useEffect(() => {
    if (selectedWindow && selectedWindow.feature_results) {
      const keys = Object.keys(selectedWindow.feature_results);
      if (keys.length > 0 && !selectedFeatureForComparison) {
        // Prefer first drifted feature if any
        const firstDrifted = keys.find((k) => selectedWindow.feature_results[k].drift_detected);
        setSelectedFeatureForComparison(firstDrifted || keys[0]);
      }
    }
  }, [selectedWindow, selectedFeatureForComparison]);

  // Filter features if requested
  const featureEntries = selectedWindow
    ? Object.entries(selectedWindow.feature_results || {})
        .filter(([_, res]) => {
          if (featureFilter === 'drifted') {
            return res.drift_detected || res.psi >= customPsiThreshold;
          }
          return true;
        })
        .sort((a, b) => b[1].psi - a[1].psi)
    : [];

  // Prepare chart data: Top PSI features
  const psiChartData = selectedWindow
    ? Object.entries(selectedWindow.feature_results || {})
        .map(([name, res]) => ({
          name,
          psi: res.psi,
          drifted: res.drift_detected || res.psi >= customPsiThreshold
        }))
        .sort((a, b) => b.psi - a.psi)
    : [];

  // Active feature distribution comparison data
  const activeFeatureResult = selectedFeatureForComparison && selectedWindow?.feature_results
    ? selectedWindow.feature_results[selectedFeatureForComparison]
    : null;

  const distributionChartData = activeFeatureResult?.distribution_comparison || [];

  // Calculate composite 0-100 Drift Index
  const compositeDriftScore = React.useMemo(() => {
    if (!selectedWindow) return 0;
    const psiComponent = Math.min(50, (selectedWindow.overall_psi / 0.50) * 50);
    const ratioComponent =
      selectedWindow.total_features_count > 0
        ? (selectedWindow.drifted_features_count / selectedWindow.total_features_count) * 50
        : 0;
    return Math.min(100, Math.round(psiComponent + ratioComponent));
  }, [selectedWindow]);

  return (
    <div className="space-y-6">
      {/* 4-Pillar Taxonomy Explanation Banner */}
      <div className="glass-panel p-5 rounded-2xl border border-indigo-500/20 bg-indigo-950/20">
        <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
          <Info className="w-4 h-4 text-indigo-400" />
          Drift Taxonomy: Statistical vs Practical Degradation
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="font-semibold text-indigo-300 block">1. Data Drift P(X)</span>
            <span className="text-slate-400 text-[11px]">
              Input covariate displacement tested via KS 2-Sample & Chi-Square with BH correction.
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="font-semibold text-cyan-300 block">2. Practical Effect Size</span>
            <span className="text-slate-400 text-[11px]">
              Quantified via PSI (&ge; 0.25) & Wasserstein Distance to prevent false-alarm cascades.
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="font-semibold text-amber-300 block">3. Concept Shift P(Y|X)</span>
            <span className="text-slate-400 text-[11px]">
              Underlying relationship changes (e.g. shock) where identical inputs yield different true outcomes.
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="font-semibold text-rose-300 block">4. Degradation &Delta;F1</span>
            <span className="text-slate-400 text-[11px]">
              True model degradation audited independently when delayed ground-truth labels arrive.
            </span>
          </div>
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
            onChange={(e) => {
              setSelectedWindowId(e.target.value);
              setSelectedFeatureForComparison(null);
            }}
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
              <span className="text-xs text-slate-400 font-mono">COMPOSITE DRIFT INDEX</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-white">{compositeDriftScore}</span>
                <span className="text-xs text-slate-400">/ 100</span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    compositeDriftScore >= 50
                      ? 'bg-rose-950 text-rose-300'
                      : compositeDriftScore >= 25
                      ? 'bg-amber-950 text-amber-300'
                      : 'bg-emerald-950 text-emerald-300'
                  }`}
                >
                  {compositeDriftScore >= 50 ? 'HIGH' : compositeDriftScore >= 25 ? 'MODERATE' : 'LOW'}
                </span>
              </div>
            </div>

            <div className="glass-panel p-4 rounded-xl">
              <span className="text-xs text-slate-400 font-mono">MEAN / MAX PSI</span>
              <p className="text-xl font-bold text-white mt-1">
                {selectedWindow.overall_psi.toFixed(4)}
              </p>
            </div>

            <div className="glass-panel p-4 rounded-xl">
              <span className="text-xs text-slate-400 font-mono">DRIFTED FEATURES</span>
              <p className="text-xl font-bold text-amber-400 mt-1">
                {selectedWindow.drifted_features_count} / {selectedWindow.total_features_count}
              </p>
            </div>
          </div>

          {/* Configurable Thresholds & Repeated Drift Watcher */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Threshold controls */}
            <div className="glass-panel p-4 rounded-xl col-span-2 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                  Interactive Threshold Simulation
                </span>
                <span className="text-[11px] text-slate-400">
                  Simulate filtering sensitivity on this window
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="flex justify-between text-slate-400 mb-1">
                    <span>PSI Practical Drift Threshold:</span>
                    <span className="font-mono text-indigo-300 font-bold">{customPsiThreshold.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="0.40"
                    step="0.05"
                    value={customPsiThreshold}
                    onChange={(e) => setCustomPsiThreshold(parseFloat(e.target.value))}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                  <span className="text-[10px] text-slate-500 block mt-1">
                    Standard industry rules: 0.10 warning, 0.25 critical action
                  </span>
                </div>

                <div>
                  <div className="flex justify-between text-slate-400 mb-1">
                    <span>BH FDR Significance (&alpha;):</span>
                    <span className="font-mono text-indigo-300 font-bold">{customAlpha.toFixed(2)}</span>
                  </div>
                  <div className="flex gap-2 mt-1">
                    {[0.01, 0.05, 0.10].map((alphaVal) => (
                      <button
                        key={alphaVal}
                        onClick={() => setCustomAlpha(alphaVal)}
                        className={`flex-1 py-1 rounded-lg font-mono text-xs transition ${
                          customAlpha === alphaVal
                            ? 'bg-indigo-600 text-white font-bold'
                            : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        {alphaVal.toFixed(2)}
                      </button>
                    ))}
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-1">
                    Controls expected False Discovery Rate across hypothesis tests
                  </span>
                </div>
              </div>
            </div>

            {/* Repeatedly Drifting Features */}
            <div className="glass-panel p-4 rounded-xl flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  Repeatedly Drifting Features
                </span>
                <p className="text-[11px] text-slate-400 mb-2">
                  Across all {windows.length} recorded monitoring windows:
                </p>

                <div className="space-y-1.5">
                  {featureRepeatDriftCounts.slice(0, 3).map(([feat, cnt]) => (
                    <div key={feat} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-slate-900/80 border border-slate-800/80">
                      <span className="font-mono text-slate-300">{feat}</span>
                      <span className="text-amber-400 font-bold text-[11px]">{cnt} windows</span>
                    </div>
                  ))}
                  {featureRepeatDriftCounts.length === 0 && (
                    <span className="text-[11px] text-slate-500 italic">No persistent drifts recorded</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Distribution Comparison Section */}
          {selectedFeatureForComparison && activeFeatureResult && (
            <div className="glass-panel p-5 rounded-2xl border border-indigo-500/30">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                <div>
                  <h4 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-cyan-400" />
                    Feature Distribution Shift: <span className="text-indigo-300 font-mono">{selectedFeatureForComparison}</span>
                  </h4>
                  <p className="text-xs text-slate-400">
                    Comparing baseline reference vs current monitoring window across quantile deciles/categories.
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
                    PSI: <strong className="text-emerald-400">{activeFeatureResult.psi.toFixed(4)}</strong>
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
                    W-dist: <strong className="text-cyan-400">{activeFeatureResult.normalized_wasserstein?.toFixed(2) ?? 'N/A'}&sigma;</strong>
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
                    Raw p-val: <strong>{activeFeatureResult.raw_p_value < 0.0001 ? '<0.0001' : activeFeatureResult.raw_p_value.toFixed(4)}</strong>
                  </span>
                </div>
              </div>

              {distributionChartData.length > 0 ? (
                <div className="h-60 w-full p-2 bg-slate-900/60 rounded-xl border border-slate-800/80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={distributionChartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                      <XAxis dataKey="bin_label" stroke="#64748b" fontSize={10} tickLine={false} />
                      <YAxis stroke="#64748b" fontSize={10} tickLine={false} unit="%" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          border: '1px solid #334155',
                          borderRadius: '8px',
                          fontSize: '11px',
                          color: '#e2e8f0'
                        }}
                        formatter={(val: any) => [`${val}%`, '']}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                      <Bar dataKey="baseline_pct" name="Baseline Distribution (%)" fill="#6366f1" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="current_pct" name="Current Batch (%)" fill="#38bdf8" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="py-8 text-center text-slate-500 text-xs">
                  Distribution histogram bins available on next replayed stream.
                </div>
              )}
            </div>
          )}

          {/* PSI Distribution Ranking Chart */}
          <div className="glass-panel p-5 rounded-2xl">
            <h4 className="text-sm font-bold text-white tracking-wide mb-1">
              Feature Population Stability Index (PSI) Ranking
            </h4>
            <p className="text-xs text-slate-400 mb-4">
              Click any bar to inspect its live distribution comparison above.
            </p>
            <div className="h-44 w-full">
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
                  <Bar
                    dataKey="psi"
                    radius={[4, 4, 0, 0]}
                    onClick={(data) => {
                      if (data?.name) setSelectedFeatureForComparison(data.name);
                    }}
                    cursor="pointer"
                  >
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
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-white tracking-wide">
                  Per-Feature Statistical Drift Diagnostics
                </h4>
                <p className="text-xs text-slate-400">
                  Kolmogorov–Smirnov (continuous), Chi-square (categorical), BH adjusted q-values, and Wasserstein distance
                </p>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                Showing {featureEntries.length} features
              </span>
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
                    <th className="px-4 py-3">Effect Size</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {featureEntries.map(([featName, res]) => {
                    const isSelected = selectedFeatureForComparison === featName;
                    const isDrifted = res.drift_detected || res.psi >= customPsiThreshold;

                    return (
                      <tr
                        key={featName}
                        onClick={() => setSelectedFeatureForComparison(featName)}
                        className={`cursor-pointer transition ${
                          isSelected
                            ? 'bg-indigo-950/40 border-l-2 border-indigo-400'
                            : isDrifted
                            ? 'bg-amber-950/10 hover:bg-slate-800/40'
                            : 'hover:bg-slate-800/30'
                        }`}
                      >
                        <td className="px-4 py-3 font-semibold text-white flex items-center gap-1.5">
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
                          {featName}
                        </td>
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
                                ? 'text-rose-400 font-bold'
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
                          {isDrifted ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-400 bg-rose-950/70 border border-rose-800/60 px-2 py-0.5 rounded-full">
                              DRIFT DETECTED
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-950/50 border border-emerald-800/40 px-2 py-0.5 rounded-full">
                              STABLE
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFeatureForComparison(featName);
                            }}
                            className={`px-2 py-1 rounded text-[11px] font-sans font-medium transition ${
                              isSelected
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-900 text-slate-400 hover:text-white'
                            }`}
                          >
                            Distribution
                          </button>
                        </td>
                      </tr>
                    );
                  })}
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
