import React from 'react';
import {
  Tag,
  ShieldAlert
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import type { ModelRegistration, ModelQualityHistory, StreamSession } from '../types';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';

interface ModelQualityPageProps {
  model: ModelRegistration | null;
  qualityHistory: ModelQualityHistory | null;
  activeStream: StreamSession | null;
  onAttachBatchLabels: (batchId: string, groundTruth: number[]) => Promise<void>;
  isLoading: boolean;
}

export const ModelQualityPage: React.FC<ModelQualityPageProps> = ({
  model,
  qualityHistory,
  activeStream,
  onAttachBatchLabels,
  isLoading
}) => {
  const snapshots = qualityHistory?.snapshots || [];
  const latestSnapshot = snapshots[0] || null;

  const baselineF1 = model?.baseline_metrics?.primary_f1 ?? 0;
  const currentF1 = latestSnapshot?.f1_macro ?? baselineF1;
  const deltaF1 = latestSnapshot?.delta_f1_baseline ?? 0;

  // Build chart data for F1 over labeled snapshots
  const qualityTrendData = [...snapshots].reverse().map((snap, idx) => ({
    name: `Batch #${idx + 1}`,
    f1: snap.f1_macro,
    baseline: baselineF1,
    accuracy: snap.accuracy
  }));

  const handleSimulateDelayedLabels = async () => {
    if (!activeStream || !activeStream.batches || activeStream.batches.length === 0) return;
    const batch = activeStream.batches[0];
    // Create realistic labels: match batch size
    const n = batch.records_count;
    const labels = Array.from({ length: n }, (_, i) => (i % 4 === 0 ? 1 : 0));
    await onAttachBatchLabels(batch.id, labels);
  };

  return (
    <div className="space-y-6">
      {/* Delayed Label Explanation Banner */}
      <div className="glass-panel p-4 rounded-xl border border-indigo-500/30 bg-indigo-950/20 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-indigo-400 mt-0.5 shrink-0" />
        <div className="text-xs text-slate-300 leading-relaxed">
          <span className="font-bold text-white">Delayed Label Architecture: </span>
          In production ML systems, true outcome labels (e.g. loan defaults, fraud confirmations) arrive days or months after predictions are issued.
          DriftGuard attaches delayed ground-truth feedback to previously recorded inference batches, calculating true performance degradation (<span className="font-mono text-indigo-300">&Delta; Macro-F1</span>)
          independently from input feature drift.
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-xl">
          <span className="text-xs text-slate-400 font-mono">CURRENT STATUS</span>
          <div className="mt-2">
            <StatusBadge status={qualityHistory?.current_status || 'HEALTHY'} />
          </div>
        </div>

        <div className="glass-panel p-5 rounded-xl">
          <span className="text-xs text-slate-400 font-mono">LABELED MACRO-F1</span>
          <p className="text-2xl font-bold text-white mt-1">
            {currentF1.toFixed(4)}
          </p>
          <span
            className={`text-xs font-semibold ${
              deltaF1 < -0.05
                ? 'text-rose-400'
                : deltaF1 > 0
                ? 'text-emerald-400'
                : 'text-slate-400'
            }`}
          >
            {deltaF1 >= 0 ? '+' : ''}{deltaF1.toFixed(4)} vs Baseline
          </span>
        </div>

        <div className="glass-panel p-5 rounded-xl">
          <span className="text-xs text-slate-400 font-mono">LABELED ACCURACY</span>
          <p className="text-2xl font-bold text-white mt-1">
            {latestSnapshot ? `${(latestSnapshot.accuracy * 100).toFixed(1)}%` : 'N/A'}
          </p>
        </div>

        <div className="glass-panel p-5 rounded-xl">
          <span className="text-xs text-slate-400 font-mono">LABELED SAMPLES AUDITED</span>
          <p className="text-2xl font-bold text-indigo-400 mt-1">
            {snapshots.reduce((acc, s) => acc + s.samples_count, 0)}
          </p>
        </div>
      </div>

      {/* Quality Trend Line Chart */}
      {snapshots.length > 0 && (
        <div className="glass-panel p-5 rounded-2xl">
          <h4 className="text-sm font-bold text-white tracking-wide mb-1">
            Predictive Quality Trajectory (Macro-F1 vs Baseline)
          </h4>
          <p className="text-xs text-slate-400 mb-4">
            Auditing real performance as delayed labels are attached to inference batches
          </p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={qualityTrendData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} domain={[0.4, 1.0]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="f1"
                  name="Observed Macro-F1"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="baseline"
                  name="Baseline Benchmark"
                  stroke="#94a3b8"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Latest Snapshot Confusion Matrix & Class Breakdown */}
      {latestSnapshot && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Confusion Matrix */}
          <div className="glass-panel p-5 rounded-2xl">
            <h4 className="text-sm font-bold text-white tracking-wide mb-1">
              Latest Batch Confusion Matrix
            </h4>
            <p className="text-xs text-slate-400 mb-4">
              Ground-truth vs Predicted class assignments ({latestSnapshot.samples_count} rows)
            </p>

            <div className="grid grid-cols-2 gap-3 text-center font-mono">
              <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/40">
                <span className="text-[10px] text-slate-400 block uppercase">True Negative</span>
                <span className="text-xl font-bold text-emerald-400">
                  {latestSnapshot.confusion_matrix[0]?.[0]}
                </span>
              </div>
              <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-800/30">
                <span className="text-[10px] text-slate-400 block uppercase">False Positive</span>
                <span className="text-xl font-bold text-rose-400">
                  {latestSnapshot.confusion_matrix[0]?.[1]}
                </span>
              </div>
              <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-800/30">
                <span className="text-[10px] text-slate-400 block uppercase">False Negative</span>
                <span className="text-xl font-bold text-rose-400">
                  {latestSnapshot.confusion_matrix[1]?.[0]}
                </span>
              </div>
              <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/40">
                <span className="text-[10px] text-slate-400 block uppercase">True Positive</span>
                <span className="text-xl font-bold text-emerald-400">
                  {latestSnapshot.confusion_matrix[1]?.[1]}
                </span>
              </div>
            </div>
          </div>

          {/* Precision / Recall / ROC Breakdown */}
          <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between">
            <div>
              <h4 className="text-sm font-bold text-white tracking-wide mb-1">
                Detailed Diagnostic Metrics
              </h4>
              <p className="text-xs text-slate-400 mb-4">
                Comparison against model baseline threshold
              </p>

              <div className="space-y-3 font-mono text-xs">
                <div className="flex justify-between items-center p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-slate-400">Precision:</span>
                  <span className="text-white font-bold">{latestSnapshot.precision.toFixed(4)}</span>
                </div>
                <div className="flex justify-between items-center p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-slate-400">Recall:</span>
                  <span className="text-white font-bold">{latestSnapshot.recall.toFixed(4)}</span>
                </div>
                <div className="flex justify-between items-center p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-slate-400">ROC-AUC:</span>
                  <span className="text-cyan-400 font-bold">
                    {latestSnapshot.roc_auc ? latestSnapshot.roc_auc.toFixed(4) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-slate-400">Delta Macro-F1 (&Delta;):</span>
                  <span className={`font-bold ${deltaF1 < -0.05 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {deltaF1.toFixed(4)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 text-[11px] text-slate-400">
              Evaluated on {new Date(latestSnapshot.created_at).toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* Quick Delayed Label Attachment Tool */}
      {activeStream && activeStream.batches && activeStream.batches.length > 0 && (
        <div className="glass-panel p-5 rounded-2xl border border-indigo-500/30">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Tag className="w-4 h-4 text-indigo-400" />
                Simulate Delayed Label Arrival for Stream
              </h4>
              <p className="text-xs text-slate-400">
                Stream <span className="font-mono text-indigo-300">{activeStream.name}</span> has {activeStream.batches.length} prediction batches available.
              </p>
            </div>
            <button
              onClick={handleSimulateDelayedLabels}
              disabled={isLoading}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition disabled:opacity-50"
            >
              Attach Ground Truth to Batch #1
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
