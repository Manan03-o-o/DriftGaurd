import React, { useState } from 'react';
import { Cpu, PlusCircle, Database } from 'lucide-react';
import type { ModelRegistration } from '../types';

interface ModelsPageProps {
  models: ModelRegistration[];
  selectedModel: ModelRegistration | null;
  onSelectModel: (id: string) => void;
  onOpenTrainModal: () => void;
}

export const ModelsPage: React.FC<ModelsPageProps> = ({
  models,
  selectedModel,
  onSelectModel,
  onOpenTrainModal
}) => {
  const [activeTab, setActiveTab] = useState<'metrics' | 'schema'>('metrics');

  const baseline = selectedModel?.baseline_metrics;
  const schema = selectedModel?.feature_schema;

  return (
    <div className="space-y-6">
      {/* Header action banner */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-white tracking-wide">Model Inventory & Baseline Metadata</h3>
          <p className="text-xs text-slate-400">
            Registered baseline classification models, preprocessing pipelines, and leakage-safe validation metrics.
          </p>
        </div>
        <button
          onClick={onOpenTrainModal}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Train New Model</span>
        </button>
      </div>

      {/* Model Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {models.map((m) => {
          const isSelected = selectedModel?.id === m.id;
          return (
            <div
              key={m.id}
              onClick={() => onSelectModel(m.id)}
              className={`p-5 rounded-2xl cursor-pointer transition-all ${
                isSelected
                  ? 'glass-panel border-indigo-500/80 shadow-lg shadow-indigo-500/10'
                  : 'glass-panel opacity-75 hover:opacity-100 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white tracking-tight">{m.name}</h4>
                    <span className="text-[11px] font-mono text-indigo-400">v{m.version}</span>
                  </div>
                </div>
                {isSelected && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800 font-semibold">
                    ACTIVE
                  </span>
                )}
              </div>

              <div className="space-y-1.5 text-xs text-slate-400 font-mono mt-4">
                <div className="flex justify-between">
                  <span>Algorithm:</span>
                  <span className="text-slate-200 capitalize">{m.algorithm.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Dataset:</span>
                  <span className="text-slate-200">{m.dataset_name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Val Macro-F1:</span>
                  <span className="text-emerald-400 font-semibold">
                    {m.baseline_metrics?.primary_f1?.toFixed(3) ?? 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Features:</span>
                  <span className="text-slate-300">{m.feature_schema?.feature_count ?? 0}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Model Detailed Inspector */}
      {selectedModel && (
        <div className="glass-panel rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Database className="w-5 h-5 text-indigo-400" />
              <div>
                <h4 className="text-sm font-bold text-white">{selectedModel.name} Specification</h4>
                <p className="text-[11px] text-slate-400 font-mono">ID: {selectedModel.id}</p>
              </div>
            </div>

            {/* Sub-tabs */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
              <button
                onClick={() => setActiveTab('metrics')}
                className={`px-3 py-1 rounded-lg font-medium transition ${
                  activeTab === 'metrics' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Validation Metrics
              </button>
              <button
                onClick={() => setActiveTab('schema')}
                className={`px-3 py-1 rounded-lg font-medium transition ${
                  activeTab === 'schema' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Feature Schema ({schema?.feature_count ?? 0})
              </button>
            </div>
          </div>

          <div className="p-6">
            {activeTab === 'metrics' ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-xs text-slate-400">Validation Accuracy</span>
                    <p className="text-xl font-bold text-white mt-1">
                      {((baseline?.val_metrics?.accuracy ?? 0) * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-xs text-slate-400">Validation Macro-F1</span>
                    <p className="text-xl font-bold text-emerald-400 mt-1">
                      {baseline?.val_metrics?.f1_macro?.toFixed(4) ?? 'N/A'}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-xs text-slate-400">Precision / Recall</span>
                    <p className="text-xl font-bold text-white mt-1">
                      {baseline?.val_metrics?.precision?.toFixed(3)} / {baseline?.val_metrics?.recall?.toFixed(3)}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-xs text-slate-400">Validation ROC-AUC</span>
                    <p className="text-xl font-bold text-cyan-400 mt-1">
                      {baseline?.val_metrics?.roc_auc ? baseline.val_metrics.roc_auc.toFixed(4) : 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Confusion Matrix */}
                {baseline?.val_metrics?.confusion_matrix && (
                  <div>
                    <h5 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
                      Held-Out Validation Confusion Matrix
                    </h5>
                    <div className="inline-block p-4 rounded-xl bg-slate-900/90 border border-slate-800">
                      <div className="grid grid-cols-2 gap-2 text-center text-xs font-mono">
                        <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800/40">
                          <span className="text-slate-400 text-[10px] block">True Negative (TN)</span>
                          <span className="text-emerald-400 font-bold text-base">
                            {baseline.val_metrics.confusion_matrix[0]?.[0]}
                          </span>
                        </div>
                        <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/30">
                          <span className="text-slate-400 text-[10px] block">False Positive (FP)</span>
                          <span className="text-rose-400 font-bold text-base">
                            {baseline.val_metrics.confusion_matrix[0]?.[1]}
                          </span>
                        </div>
                        <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/30">
                          <span className="text-slate-400 text-[10px] block">False Negative (FN)</span>
                          <span className="text-rose-400 font-bold text-base">
                            {baseline.val_metrics.confusion_matrix[1]?.[0]}
                          </span>
                        </div>
                        <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800/40">
                          <span className="text-slate-400 text-[10px] block">True Positive (TP)</span>
                          <span className="text-emerald-400 font-bold text-base">
                            {baseline.val_metrics.confusion_matrix[1]?.[1]}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <h5 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
                    Numerical Features & Reference Distributions
                  </h5>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800 text-[10px]">
                        <tr>
                          <th className="px-4 py-2.5">Feature</th>
                          <th className="px-4 py-2.5">Mean</th>
                          <th className="px-4 py-2.5">Std Dev</th>
                          <th className="px-4 py-2.5">Median</th>
                          <th className="px-4 py-2.5">Min - Max</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-300">
                        {schema?.numerical_features.map((feat) => {
                          const stats = schema?.feature_stats?.[feat];
                          return (
                            <tr key={feat} className="hover:bg-slate-800/30">
                              <td className="px-4 py-2.5 text-indigo-300 font-medium">{feat}</td>
                              <td className="px-4 py-2.5">{stats?.mean ?? 'N/A'}</td>
                              <td className="px-4 py-2.5">{stats?.std ?? 'N/A'}</td>
                              <td className="px-4 py-2.5">{stats?.median ?? 'N/A'}</td>
                              <td className="px-4 py-2.5 text-slate-400">
                                {stats?.min} to {stats?.max}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {schema?.categorical_features && schema.categorical_features.length > 0 && (
                  <div className="pt-4">
                    <h5 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
                      Categorical Features & Levels
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {schema.categorical_features.map((cat) => (
                        <div key={cat} className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
                          <span className="text-xs font-semibold text-indigo-300">{cat}</span>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {schema?.categorical_categories?.[cat]?.map((val) => (
                              <span
                                key={val}
                                className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/60 font-mono"
                              >
                                {val}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
