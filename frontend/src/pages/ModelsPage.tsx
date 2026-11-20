import React, { useState, useEffect } from 'react';
import {
  Cpu,
  PlusCircle,
  Database,
  GitCompare,
  BarChart2,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  ShieldCheck,
  Search,
  ArrowRight,
  Award
} from 'lucide-react';
import type { ModelRegistration, ModelExplainability, ModelComparison } from '../types';
import { api } from '../services/api';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell
} from 'recharts';

interface ModelsPageProps {
  models: ModelRegistration[];
  selectedModel: ModelRegistration | null;
  onSelectModel: (id: string) => void;
  onOpenTrainModal: () => void;
  onActivateModel?: (id: string) => Promise<void>;
}

export const ModelsPage: React.FC<ModelsPageProps> = ({
  models,
  selectedModel,
  onSelectModel,
  onOpenTrainModal,
  onActivateModel
}) => {
  const [activeTab, setActiveTab] = useState<'metrics' | 'schema' | 'explainability' | 'compare'>('metrics');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAlgorithm, setFilterAlgorithm] = useState<string>('all');

  // Explainability state
  const [explainability, setExplainability] = useState<ModelExplainability | null>(null);
  const [isLoadingExplainability, setIsLoadingExplainability] = useState(false);

  // Champion vs Challenger state
  const activeModel = models.find((m) => m.is_active) || models[0];
  const [challengerId, setChallengerId] = useState<string>('');
  const [tolerance, setTolerance] = useState<number>(0.02);
  const [comparisonResult, setComparisonResult] = useState<ModelComparison | null>(null);
  const [isComparing, setIsComparing] = useState(false);

  // Confirmation modal state
  const [pendingActivationId, setPendingActivationId] = useState<string | null>(null);

  // Fetch explainability when selected model or tab changes
  useEffect(() => {
    if (selectedModel && activeTab === 'explainability') {
      setIsLoadingExplainability(true);
      api.getModelExplainability(selectedModel.id)
        .then((data) => setExplainability(data))
        .catch((err) => console.error('Error fetching explainability:', err))
        .finally(() => setIsLoadingExplainability(false));
    }
  }, [selectedModel?.id, activeTab]);

  // Set default challenger when model changes
  useEffect(() => {
    if (selectedModel) {
      if (selectedModel.id !== activeModel?.id) {
        setChallengerId(selectedModel.id);
      } else {
        const other = models.find((m) => m.id !== activeModel?.id);
        if (other) setChallengerId(other.id);
      }
    }
  }, [selectedModel?.id, activeModel?.id, models]);

  const handleRunComparison = async () => {
    if (!activeModel || !challengerId) return;
    try {
      setIsComparing(true);
      const res = await api.compareModels({
        champion_id: activeModel.id,
        challenger_id: challengerId,
        tolerance
      });
      setComparisonResult(res);
    } catch (err: any) {
      console.error('Comparison error:', err);
    } finally {
      setIsComparing(false);
    }
  };

  const handleConfirmActivation = async () => {
    if (!pendingActivationId || !onActivateModel) return;
    await onActivateModel(pendingActivationId);
    setPendingActivationId(null);
  };

  const baseline = selectedModel?.baseline_metrics;
  const schema = selectedModel?.feature_schema;

  // Filtered models
  const filteredModels = models.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.version.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.dataset_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAlgo = filterAlgorithm === 'all' || m.algorithm === filterAlgorithm;
    return matchesSearch && matchesAlgo;
  });

  return (
    <div className="space-y-6">
      {/* Header action banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white tracking-wide">Model Inventory & Baseline Metadata</h3>
          <p className="text-xs text-slate-400">
            Registered baseline classification models, preprocessing pipelines, Champion vs Challenger audits, and explainability.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('compare')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold shadow-sm transition"
          >
            <GitCompare className="w-4 h-4 text-cyan-400" />
            <span>Champion vs Challenger</span>
          </button>
          <button
            onClick={onOpenTrainModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Train New Model</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 glass-panel p-3.5 rounded-2xl">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search models by name, version or dataset..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-xs text-white placeholder-slate-500 outline-none w-full"
          />
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400 font-medium">Algorithm:</span>
          <select
            value={filterAlgorithm}
            onChange={(e) => setFilterAlgorithm(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white outline-none cursor-pointer"
          >
            <option value="all">All Algorithms</option>
            <option value="random_forest">Random Forest</option>
            <option value="logistic_regression">Logistic Regression</option>
            <option value="hist_gradient_boosting">Hist Gradient Boosting</option>
          </select>
        </div>
      </div>

      {/* Model Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {filteredModels.map((m) => {
          const isSelected = selectedModel?.id === m.id;
          return (
            <div
              key={m.id}
              onClick={() => onSelectModel(m.id)}
              className={`p-5 rounded-2xl cursor-pointer transition-all flex flex-col justify-between ${
                isSelected
                  ? 'glass-panel border-indigo-500/80 shadow-lg shadow-indigo-500/10'
                  : 'glass-panel opacity-80 hover:opacity-100 hover:border-slate-700'
              }`}
            >
              <div>
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
                  {m.is_active ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-semibold flex items-center gap-1">
                      <Award className="w-3 h-3 text-emerald-400" />
                      CHAMPION
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 text-slate-400 border border-slate-800 font-mono">
                      STANDBY
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

              {!m.is_active && onActivateModel && (
                <div className="mt-4 pt-3 border-t border-slate-800/80">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPendingActivationId(m.id);
                    }}
                    className="w-full py-1.5 rounded-xl bg-slate-900 hover:bg-emerald-950/60 text-slate-300 hover:text-emerald-400 border border-slate-800 hover:border-emerald-800/50 text-xs font-semibold transition"
                  >
                    Promote to Champion
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected Model Detailed Inspector */}
      {selectedModel && (
        <div className="glass-panel rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Database className="w-5 h-5 text-indigo-400" />
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-white">{selectedModel.name}</h4>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 font-mono">
                    v{selectedModel.version}
                  </span>
                  {selectedModel.is_active && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                      ACTIVE PRODUCTION CHAMPION
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">ID: {selectedModel.id}</p>
              </div>
            </div>

            {/* Sub-tabs */}
            <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
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
              <button
                onClick={() => setActiveTab('explainability')}
                className={`px-3 py-1 rounded-lg font-medium transition flex items-center gap-1.5 ${
                  activeTab === 'explainability' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                Explainability
              </button>
              <button
                onClick={() => setActiveTab('compare')}
                className={`px-3 py-1 rounded-lg font-medium transition flex items-center gap-1.5 ${
                  activeTab === 'compare' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <GitCompare className="w-3.5 h-3.5" />
                Champion vs Challenger
              </button>
            </div>
          </div>

          <div className="p-6">
            {/* TAB 1: VALIDATION METRICS */}
            {activeTab === 'metrics' && (
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
            )}

            {/* TAB 2: SCHEMA */}
            {activeTab === 'schema' && (
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

            {/* TAB 3: EXPLAINABILITY */}
            {activeTab === 'explainability' && (
              <div className="space-y-6">
                {/* Academic Disclaimer Banner */}
                <div className="glass-panel p-4 rounded-xl border-l-4 border-l-indigo-500 bg-indigo-950/20 flex items-start gap-3">
                  <HelpCircle className="w-5 h-5 text-indigo-400 mt-0.5 shrink-0" />
                  <div className="text-xs text-slate-300 leading-relaxed">
                    <span className="font-semibold text-white">Statistical Importance vs Causal Attribution: </span>
                    {explainability?.educational_disclaimer ||
                      'Feature importance quantifies the statistical contribution of features to model prediction logits within decision boundaries, not counterfactual or real-world causal mechanisms.'}
                  </div>
                </div>

                {isLoadingExplainability ? (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    Calculating model feature importances from pipeline artifact...
                  </div>
                ) : explainability ? (
                  <div className="space-y-6">
                    {/* Summary Drivers */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                        <span className="text-xs text-slate-400">Primary Risk Driver</span>
                        <p className="text-base font-bold text-white mt-1 capitalize">
                          {explainability.sample_prediction_explanation?.top_risk_driver.replace(/_/g, ' ')}
                        </p>
                      </div>
                      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                        <span className="text-xs text-slate-400">Secondary Risk Driver</span>
                        <p className="text-base font-bold text-indigo-300 mt-1 capitalize">
                          {explainability.sample_prediction_explanation?.secondary_risk_driver.replace(/_/g, ' ')}
                        </p>
                      </div>
                      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                        <span className="text-xs text-slate-400">Attribution Method</span>
                        <p className="text-xs font-semibold text-slate-300 mt-1">
                          {explainability.method}
                        </p>
                      </div>
                    </div>

                    {/* Chart: Feature Importances */}
                    <div>
                      <h5 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
                        Relative Feature Importance (% Contribution)
                      </h5>
                      <div className="h-64 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            layout="vertical"
                            data={explainability.feature_importances}
                            margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                          >
                            <XAxis type="number" unit="%" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                            <YAxis
                              type="category"
                              dataKey="feature"
                              tick={{ fill: '#cbd5e1', fontSize: 11 }}
                              width={110}
                            />
                            <Tooltip
                              formatter={(value: any) => [`${value}%`, 'Relative Importance']}
                              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '11px' }}
                            />
                            <Bar dataKey="percentage" radius={[0, 6, 6, 0]}>
                              {explainability.feature_importances.map((_, index) => (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={index === 0 ? '#6366f1' : index === 1 ? '#818cf8' : '#38bdf8'}
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Table breakdown */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs font-mono">
                        <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800 text-[10px]">
                          <tr>
                            <th className="px-4 py-2.5">Feature Name</th>
                            <th className="px-4 py-2.5">Raw Importance Score</th>
                            <th className="px-4 py-2.5">Relative Share (%)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 text-slate-300">
                          {explainability.feature_importances.map((item) => (
                            <tr key={item.feature} className="hover:bg-slate-800/30">
                              <td className="px-4 py-2.5 text-indigo-300 font-medium capitalize">
                                {item.feature.replace(/_/g, ' ')}
                              </td>
                              <td className="px-4 py-2.5">{item.importance.toFixed(5)}</td>
                              <td className="px-4 py-2.5 text-emerald-400 font-bold">{item.percentage.toFixed(2)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-slate-500 text-xs">
                    No explainability data available for this model.
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: CHAMPION VS CHALLENGER */}
            {activeTab === 'compare' && (
              <div className="space-y-6">
                <div className="glass-panel p-5 rounded-xl border border-slate-800">
                  <h5 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <GitCompare className="w-4 h-4 text-cyan-400" />
                    Configure Champion vs Challenger Evaluation
                  </h5>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-slate-400 text-xs block mb-1">Production Champion:</label>
                      <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-white flex items-center justify-between">
                        <span>{activeModel?.name || 'None'} (v{activeModel?.version || '1.0'})</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                          ACTIVE
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="text-slate-400 text-xs block mb-1">Candidate Challenger:</label>
                      <select
                        value={challengerId}
                        onChange={(e) => setChallengerId(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-semibold text-cyan-300 outline-none cursor-pointer"
                      >
                        {models.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} (v{m.version}) - {m.algorithm} {m.is_active ? '(Active Champion)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-slate-400 text-xs block mb-1">
                        Gated Tolerance: <span className="text-indigo-400 font-mono">{tolerance.toFixed(2)}</span>
                      </label>
                      <input
                        type="range"
                        min="0.00"
                        max="0.10"
                        step="0.01"
                        value={tolerance}
                        onChange={(e) => setTolerance(parseFloat(e.target.value))}
                        className="w-full accent-indigo-500 cursor-pointer mt-2"
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={handleRunComparison}
                      disabled={isComparing || !challengerId}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md transition"
                    >
                      {isComparing ? 'Evaluating Policies...' : 'Execute Head-to-Head Audit'}
                    </button>
                  </div>
                </div>

                {/* Comparison Results Cards */}
                {comparisonResult && (
                  <div className="space-y-6">
                    {/* Eligibility Banner */}
                    <div
                      className={`p-4 rounded-xl border flex items-start gap-3 ${
                        comparisonResult.is_eligible_for_promotion
                          ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
                          : 'bg-rose-950/20 border-rose-500/40 text-rose-300'
                      }`}
                    >
                      {comparisonResult.is_eligible_for_promotion ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-rose-400 mt-0.5 shrink-0" />
                      )}
                      <div>
                        <span className="font-bold block text-sm">
                          {comparisonResult.is_eligible_for_promotion
                            ? 'PROMOTION CRITERIA SATISFIED'
                            : 'PROMOTION REJECTED BY GATING POLICY'}
                        </span>
                        <p className="text-xs text-slate-300 mt-1">{comparisonResult.recommendation}</p>
                      </div>
                    </div>

                    {/* Metric Comparison Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                        <span className="text-xs text-slate-400 font-mono block">MACRO-F1</span>
                        <div className="flex items-baseline justify-between mt-2">
                          <div>
                            <span className="text-[10px] text-slate-500 block">Champion</span>
                            <span className="text-base font-bold text-white">
                              {comparisonResult.champion.metrics.f1_macro.toFixed(4)}
                            </span>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                          <div>
                            <span className="text-[10px] text-cyan-400 block">Challenger</span>
                            <span className="text-base font-bold text-cyan-300">
                              {comparisonResult.challenger.metrics.f1_macro.toFixed(4)}
                            </span>
                          </div>
                        </div>
                        <span
                          className={`text-xs font-semibold block mt-2 ${
                            comparisonResult.delta_metrics.delta_f1_macro >= 0
                              ? 'text-emerald-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {comparisonResult.delta_metrics.delta_f1_macro >= 0 ? '+' : ''}
                          {comparisonResult.delta_metrics.delta_f1_macro.toFixed(4)} Delta
                        </span>
                      </div>

                      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                        <span className="text-xs text-slate-400 font-mono block">ACCURACY</span>
                        <div className="flex items-baseline justify-between mt-2">
                          <div>
                            <span className="text-[10px] text-slate-500 block">Champion</span>
                            <span className="text-base font-bold text-white">
                              {(comparisonResult.champion.metrics.accuracy * 100).toFixed(1)}%
                            </span>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                          <div>
                            <span className="text-[10px] text-cyan-400 block">Challenger</span>
                            <span className="text-base font-bold text-cyan-300">
                              {(comparisonResult.challenger.metrics.accuracy * 100).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        <span
                          className={`text-xs font-semibold block mt-2 ${
                            comparisonResult.delta_metrics.delta_accuracy >= 0
                              ? 'text-emerald-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {comparisonResult.delta_metrics.delta_accuracy >= 0 ? '+' : ''}
                          {(comparisonResult.delta_metrics.delta_accuracy * 100).toFixed(1)}% Delta
                        </span>
                      </div>

                      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                        <span className="text-xs text-slate-400 font-mono block">PRECISION</span>
                        <div className="flex items-baseline justify-between mt-2">
                          <div>
                            <span className="text-[10px] text-slate-500 block">Champion</span>
                            <span className="text-base font-bold text-white">
                              {comparisonResult.champion.metrics.precision.toFixed(3)}
                            </span>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                          <div>
                            <span className="text-[10px] text-cyan-400 block">Challenger</span>
                            <span className="text-base font-bold text-cyan-300">
                              {comparisonResult.challenger.metrics.precision.toFixed(3)}
                            </span>
                          </div>
                        </div>
                        <span className="text-xs font-semibold block mt-2 text-slate-300">
                          {comparisonResult.delta_metrics.delta_precision >= 0 ? '+' : ''}
                          {comparisonResult.delta_metrics.delta_precision.toFixed(3)} Delta
                        </span>
                      </div>

                      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                        <span className="text-xs text-slate-400 font-mono block">RECALL</span>
                        <div className="flex items-baseline justify-between mt-2">
                          <div>
                            <span className="text-[10px] text-slate-500 block">Champion</span>
                            <span className="text-base font-bold text-white">
                              {comparisonResult.champion.metrics.recall.toFixed(3)}
                            </span>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                          <div>
                            <span className="text-[10px] text-cyan-400 block">Challenger</span>
                            <span className="text-base font-bold text-cyan-300">
                              {comparisonResult.challenger.metrics.recall.toFixed(3)}
                            </span>
                          </div>
                        </div>
                        <span className="text-xs font-semibold block mt-2 text-slate-300">
                          {comparisonResult.delta_metrics.delta_recall >= 0 ? '+' : ''}
                          {comparisonResult.delta_metrics.delta_recall.toFixed(3)} Delta
                        </span>
                      </div>
                    </div>

                    {/* Promotion Action */}
                    {comparisonResult.is_eligible_for_promotion &&
                      comparisonResult.challenger.id !== activeModel.id &&
                      onActivateModel && (
                        <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/30 flex items-center justify-between">
                          <div>
                            <h6 className="text-xs font-bold text-white">Authorized Gated Promotion</h6>
                            <p className="text-[11px] text-slate-400">
                              Promoting Challenger will transition {comparisonResult.challenger.name} to the active champion model.
                            </p>
                          </div>
                          <button
                            onClick={() => setPendingActivationId(comparisonResult.challenger.id)}
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 transition"
                          >
                            Promote Challenger to Production
                          </button>
                        </div>
                      )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal for Model Activation */}
      {pendingActivationId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel p-6 rounded-2xl max-w-md w-full border border-indigo-500/40 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Confirm Model Promotion</h4>
                <p className="text-xs text-slate-400">Production Champion Switch</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to promote this model to the <span className="text-emerald-400 font-semibold">Active Production Champion</span>?
              All future inference streams, drift detection sessions, and monitoring evaluations will benchmark against this baseline model.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setPendingActivationId(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmActivation}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/30 transition"
              >
                Confirm & Activate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};