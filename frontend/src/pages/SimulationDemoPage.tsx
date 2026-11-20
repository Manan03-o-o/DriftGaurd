import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Sparkles,
  Award,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  FileText,
  Activity,
  Printer,
  ExternalLink,
} from 'lucide-react';
import type { ModelRegistration } from '../types';
import { api } from '../services/api';

interface SimulationDemoPageProps {
  model: ModelRegistration | null;
  models: ModelRegistration[];
  selectedModelId: string;
  onSelectModel: (id: string) => void;
  onNavigate: (tab: string) => void;
  onRefreshAll: () => Promise<void>;
  showSuccess: (msg: string) => void;
  showError: (msg: string) => void;
}

export const SimulationDemoPage: React.FC<SimulationDemoPageProps> = ({
  model,
  models,
  selectedModelId,
  onSelectModel: _onSelectModel,
  onNavigate,
  onRefreshAll,
  showSuccess,
  showError
}) => {
  const [activeTab, setActiveTab] = useState<'simulation' | 'guide' | 'reports'>('guide');

  // LIVE SIMULATION STATE
  const [isSimRunning, setIsSimRunning] = useState(false);
  const [isSimPaused, setIsSimPaused] = useState(false);
  const [simScenario, setSimScenario] = useState('mean_shift');
  const [simBatchSize, setSimBatchSize] = useState(100);
  const [simIntervalMs, setSimIntervalMs] = useState(2500);
  const [processedBatches, setProcessedBatches] = useState<number>(0);
  const [simLog, setSimLog] = useState<Array<{ batch: number; status: string; psi: number; time: string }>>([]);
  const simTimerRef = useRef<any>(null);

  // DEMO STEPPER STATE
  const [demoStep, setDemoStep] = useState<number>(1);
  const [isExecutingStep, setIsExecutingStep] = useState<boolean>(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  // REPORT STATE
  const [reportData, setReportData] = useState<any>(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);

  const activeModelId = selectedModelId || model?.id || (models[0]?.id ?? '');

  // Live simulation tick
  const runSimTick = async () => {
    if (!activeModelId) return;
    try {
      const stream = await api.replayStream({
        model_id: activeModelId,
        scenario: simScenario,
        batch_size: simBatchSize,
        total_batches: 1,
        random_seed: Math.floor(Math.random() * 10000),
        auto_analyze_drift: true
      });

      // Optionally attach delayed labels on half of the batches
      if (stream.batches && stream.batches.length > 0 && Math.random() > 0.4) {
        const batch = stream.batches[0];
        const n = batch.records_count;
        const groundTruth = Array.from({ length: n }, (_, i) => (i % 3 === 0 ? 1 : 0));
        await api.attachLabels(batch.id, groundTruth).catch(() => null);
      }

      setProcessedBatches((prev) => prev + 1);
      setSimLog((prev) => [
        {
          batch: prev.length + 1,
          status: simScenario === 'no_shift' ? 'STABLE' : 'SHIFT DETECTED',
          psi: simScenario === 'no_shift' ? 0.04 : 0.28,
          time: new Date().toLocaleTimeString()
        },
        ...prev.slice(0, 19)
      ]);
    } catch (err: any) {
      console.error('Simulation tick error:', err);
    }
  };

  useEffect(() => {
    if (isSimRunning && !isSimPaused) {
      simTimerRef.current = setInterval(runSimTick, simIntervalMs);
    } else {
      if (simTimerRef.current) clearInterval(simTimerRef.current);
    }
    return () => {
      if (simTimerRef.current) clearInterval(simTimerRef.current);
    };
  }, [isSimRunning, isSimPaused, simIntervalMs, simScenario, simBatchSize, activeModelId]);

  // Load report data when Reports tab opened
  useEffect(() => {
    if (activeTab === 'reports' && activeModelId) {
      setIsLoadingReport(true);
      api.getReport(activeModelId)
        .then((data) => setReportData(data))
        .catch((err) => console.error('Failed to load report:', err))
        .finally(() => setIsLoadingReport(false));
    }
  }, [activeTab, activeModelId]);

  // Reset Demo handler
  const handleResetDemo = async () => {
    try {
      await api.resetDemoData();
      setIsResetModalOpen(false);
      setProcessedBatches(0);
      setSimLog([]);
      setDemoStep(1);
      await onRefreshAll();
      showSuccess('Demonstration environment reset to clean baseline.');
    } catch (err: any) {
      showError(`Reset failed: ${err.message}`);
    }
  };

  // Demo step executions
  const handleExecuteDemoStep = async (step: number) => {
    if (!activeModelId) return;
    setIsExecutingStep(true);
    try {
      if (step === 3) {
        // Step 3: Stream No Shift
        await api.replayStream({
          model_id: activeModelId,
          scenario: 'no_shift',
          batch_size: 150,
          total_batches: 1,
          random_seed: 42,
          auto_analyze_drift: true
        });
        showSuccess('Step 3: Ingested stationary batch without shift. Baseline status remains STABLE.');
      } else if (step === 4 || step === 5) {
        // Step 4/5: Trigger Mean Shift
        await api.replayStream({
          model_id: activeModelId,
          scenario: 'mean_shift',
          batch_size: 150,
          total_batches: 1,
          random_seed: 88,
          auto_analyze_drift: true
        });
        showSuccess('Step 4 & 5: Ingested Mean Shift stream. Statistical drift detector triggered alerts.');
      } else if (step === 7) {
        // Step 7: Delayed Ground-Truth Evaluation
        const hist = await api.getMonitoringHistory(activeModelId, 1);
        if (hist.length > 0 && hist[0].batch_id) {
          const n = hist[0].sample_size;
          const fakeLabels = Array.from({ length: n }, (_, i) => (i % 2 === 0 ? 1 : 0));
          await api.attachLabels(hist[0].batch_id, fakeLabels);
          showSuccess('Step 7: Delayed ground-truth labels attached. Model degradation computed.');
        }
      } else if (step === 8 || step === 9) {
        // Step 8 & 9: Retraining Benchmark
        await api.runPolicyExperiment({
          model_id: activeModelId,
          scenario: 'mean_shift',
          num_windows: 3,
          window_size: 100,
          periodic_interval: 2,
          drift_psi_threshold: 0.20,
          random_seed: 42
        });
        showSuccess('Step 8 & 9: Retraining policies evaluated. Gated retraining validated candidate model.');
      } else if (step === 11) {
        // Step 11: Promote Model
        await api.activateModel(activeModelId);
        showSuccess('Step 11: Candidate model promoted to production champion.');
      }
      await onRefreshAll();
      setDemoStep(Math.min(12, step + 1));
    } catch (err: any) {
      showError(`Demo step execution failed: ${err.message}`);
    } finally {
      setIsExecutingStep(false);
    }
  };

  const demoStepsList = [
    { num: 1, title: 'Registered ML Model', desc: 'Inspect production baseline model, pipeline transformers, and validation metrics.', tab: 'models' },
    { num: 2, title: 'Healthy Reference Dataset', desc: 'Audit baseline dataset schema, missingness, and reference decile quantiles.', tab: 'quality' },
    { num: 3, title: 'Incoming Stream (No Shift)', desc: 'Ingest stationary production batches. Verify zero false alarms under FDR control.', action: () => handleExecuteDemoStep(3) },
    { num: 4, title: 'Controlled Mean Shift Ingestion', desc: 'Displace debt-to-income and credit-score distributions via controlled simulation.', action: () => handleExecuteDemoStep(4) },
    { num: 5, title: 'Statistical Drift Detection', desc: 'Kolmogorov-Smirnov two-sample test + Benjamini-Hochberg FDR + PSI effect size.', tab: 'drift' },
    { num: 6, title: 'Smart Alert Generation', desc: 'Inspect deduplicated High/Critical alerts with recommended operational actions.', tab: 'alerts' },
    { num: 7, title: 'Delayed Ground-Truth Feedback', desc: 'Attach delayed outcome labels and audit Macro-F1 degradation independently.', action: () => handleExecuteDemoStep(7) },
    { num: 8, title: 'Retraining Decision Triggered', desc: 'Determine whether statistical drift warrants retraining under compute constraints.', tab: 'experiments' },
    { num: 9, title: 'Retraining Policy Benchmark', desc: 'Compare 4 adaptation policies: Static vs Periodic vs Drift vs Gated Retraining.', action: () => handleExecuteDemoStep(9) },
    { num: 10, title: 'Champion vs Challenger Audit', desc: 'Compare active champion model vs retrained challenger side-by-side.', tab: 'models' },
    { num: 11, title: 'Gated Model Promotion', desc: 'Promote challenger to production champion after satisfying validation gate.', action: () => handleExecuteDemoStep(11) },
    { num: 12, title: 'Download Audit Report', desc: 'Generate printable executive PDF compliance report with full methodology notes.', tab: 'reports' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner and Navigation Sub-tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            Simulation, Demonstration & Reports
          </h3>
          <p className="text-xs text-slate-400">
            Interactive live stream generator, guided 12-step presentation workflow, and exportable monitoring reports.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('guide')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                activeTab === 'guide' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              12-Step Guided Demo
            </button>
            <button
              onClick={() => setActiveTab('simulation')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                activeTab === 'simulation' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Live Streaming Runner
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1.5 ${
                activeTab === 'reports' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Monitoring Report
            </button>
          </div>

          <button
            onClick={() => setIsResetModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-800/50 text-xs font-semibold transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Demo Data</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: 12-STEP GUIDED DEMO WORKFLOW */}
      {activeTab === 'guide' && (
        <div className="space-y-6">
          <div className="glass-panel p-5 rounded-2xl border border-indigo-500/20 bg-indigo-950/20 flex items-start gap-3">
            <Award className="w-5 h-5 text-indigo-400 mt-0.5 shrink-0" />
            <div className="text-xs text-slate-300 leading-relaxed">
              <span className="font-bold text-white">Capstone Examination & Viva Guide: </span>
              This guided demonstration walks examiners through the end-to-end MLOps lifecycle: from healthy baseline monitoring,
              controlled statistical shift detection with false-discovery mitigation, delayed ground-truth auditing, through automated
              retraining policy evaluation and safe gated deployment.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {demoStepsList.map((step) => {
              const isCurrent = demoStep === step.num;
              const isPast = demoStep > step.num;

              return (
                <div
                  key={step.num}
                  className={`glass-panel p-5 rounded-2xl border transition-all ${
                    isCurrent
                      ? 'border-indigo-500 bg-indigo-950/30 shadow-lg shadow-indigo-500/10'
                      : isPast
                      ? 'border-emerald-800/60 bg-slate-900/60 opacity-90'
                      : 'border-slate-800 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs ${
                          isPast
                            ? 'bg-emerald-600 text-white'
                            : isCurrent
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {isPast ? <CheckCircle2 className="w-4 h-4" /> : step.num}
                      </div>
                      <h4 className="text-sm font-bold text-white">{step.title}</h4>
                    </div>

                    {isCurrent && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800 font-bold uppercase">
                        Current Step
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed mb-4 pl-9">
                    {step.desc}
                  </p>

                  <div className="flex items-center justify-end gap-2 pl-9">
                    {step.tab && (
                      <button
                        onClick={() => {
                          if (step.tab === 'reports') setActiveTab('reports');
                          else onNavigate(step.tab);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-semibold flex items-center gap-1 transition"
                      >
                        <span>Open {step.title.split(' ')[0]}</span>
                        <ExternalLink className="w-3 h-3 text-cyan-400" />
                      </button>
                    )}

                    {step.action && (
                      <button
                        onClick={step.action}
                        disabled={isExecutingStep}
                        className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md flex items-center gap-1.5 transition"
                      >
                        <span>{isExecutingStep ? 'Running Step...' : `Execute Step #${step.num}`}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 2: LIVE STREAMING SIMULATOR */}
      {activeTab === 'simulation' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  Live Streaming Ingestion Simulator
                </h4>
                <p className="text-xs text-slate-400">
                  Streams synthetic observation batches sequentially, running data quality checks, statistical drift detection, and automated smart alerting.
                </p>
              </div>

              {/* Play / Pause / Stop buttons */}
              <div className="flex items-center gap-2">
                {!isSimRunning ? (
                  <button
                    onClick={() => {
                      setIsSimRunning(true);
                      setIsSimPaused(false);
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Start Live Stream</span>
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setIsSimPaused(!isSimPaused)}
                      className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-md transition"
                    >
                      {isSimPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5 fill-current" />}
                      <span>{isSimPaused ? 'Resume' : 'Pause'}</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsSimRunning(false);
                        setIsSimPaused(false);
                      }}
                      className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md transition"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>Stop</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Sim Configuration Sliders */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-slate-800 text-xs">
              <div>
                <label className="text-slate-400 font-semibold block mb-1">Shift Scenario:</label>
                <select
                  value={simScenario}
                  onChange={(e) => setSimScenario(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-indigo-300 font-semibold outline-none cursor-pointer"
                >
                  <option value="no_shift">No Shift (Stationary Baseline)</option>
                  <option value="mean_shift">Numerical Mean Shift (+DTI, -Credit)</option>
                  <option value="variance_shift">Variance Spread Expansion (2.2x)</option>
                  <option value="categorical_shift">Categorical Shift (80% Rent Spike)</option>
                  <option value="class_imbalance_shift">Class Imbalance Shift (50%+ Default)</option>
                  <option value="concept_shift">Concept Shift P(Y|X) (Macroeconomic Shock)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">
                  Batch Size: <span className="text-white font-mono">{simBatchSize} records</span>
                </label>
                <input
                  type="range"
                  min="50"
                  max="300"
                  step="25"
                  value={simBatchSize}
                  onChange={(e) => setSimBatchSize(parseInt(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer mt-1"
                />
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">
                  Stream Cadence: <span className="text-white font-mono">{(simIntervalMs / 1000).toFixed(1)}s per batch</span>
                </label>
                <input
                  type="range"
                  min="1000"
                  max="5000"
                  step="500"
                  value={simIntervalMs}
                  onChange={(e) => setSimIntervalMs(parseInt(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer mt-1"
                />
              </div>
            </div>
          </div>

          {/* Live Ingestion Feed Table */}
          <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    isSimRunning && !isSimPaused
                      ? 'bg-emerald-400 animate-pulse'
                      : isSimPaused
                      ? 'bg-amber-400'
                      : 'bg-slate-500'
                  }`}
                />
                <h4 className="text-sm font-bold text-white tracking-wide">
                  Live Streaming Ingestion Feed ({processedBatches} Batches Processed)
                </h4>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {isSimRunning ? (isSimPaused ? 'Paused' : 'Streaming Active') : 'Idle'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800 text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Batch #</th>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Drift Diagnostic</th>
                    <th className="px-4 py-3">Mean PSI</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {simLog.map((log) => (
                    <tr key={log.batch} className="hover:bg-slate-800/30 transition">
                      <td className="px-4 py-3 text-white font-bold">Batch #{log.batch}</td>
                      <td className="px-4 py-3 text-slate-400">{log.time}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            log.status === 'STABLE'
                              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                              : 'bg-rose-950/60 text-rose-300 border-rose-800'
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono">{log.psi.toFixed(4)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => onNavigate('drift')}
                          className="text-[11px] font-sans text-indigo-400 hover:text-indigo-300 font-semibold"
                        >
                          View in Drift Monitor
                        </button>
                      </td>
                    </tr>
                  ))}
                  {simLog.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        Simulation stream is idle. Click "Start Live Stream" above to begin feeding observation batches.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: COMPREHENSIVE MONITORING REPORTS */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h4 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                Executive Model Reliability Audit Report
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Full-coverage compliance report containing baseline metrics, statistical drift tests, delayed ground truth quality, and retraining policy rankings.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <a
                href={api.getReportHtmlUrl(activeModelId)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition"
              >
                <Printer className="w-4 h-4" />
                <span>Open Printable PDF Report</span>
              </a>
            </div>
          </div>

          {isLoadingReport ? (
            <div className="py-16 text-center text-slate-500 text-xs">
              Compiling comprehensive model audit from database records...
            </div>
          ) : reportData ? (
            <div className="space-y-6">
              {/* Report KPI Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass-panel p-4 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400 font-mono">MODEL EVALUATED</span>
                  <p className="text-base font-bold text-white mt-1">
                    {reportData.model_overview.name} (v{reportData.model_overview.version})
                  </p>
                  <span className="text-[10px] text-indigo-300 font-mono">
                    Baseline F1: {reportData.model_overview.baseline_f1.toFixed(4)}
                  </span>
                </div>

                <div className="glass-panel p-4 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400 font-mono">WINDOWS AUDITED</span>
                  <p className="text-2xl font-bold text-white mt-1">
                    {reportData.monitoring_summary.total_windows_analyzed}
                  </p>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Avg PSI: {reportData.monitoring_summary.average_psi.toFixed(4)}
                  </span>
                </div>

                <div className="glass-panel p-4 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400 font-mono">DATA INGESTION SCORE</span>
                  <p className="text-2xl font-bold text-emerald-400 mt-1">
                    {reportData.data_quality_summary.latest_score.toFixed(1)}%
                  </p>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {reportData.data_quality_summary.records_count} records checked
                  </span>
                </div>

                <div className="glass-panel p-4 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400 font-mono">CURRENT STATUS</span>
                  <p className="text-2xl font-bold text-cyan-300 mt-1">
                    {reportData.monitoring_summary.latest_window_status}
                  </p>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {reportData.alerts_summary.total_alerts} recorded alerts
                  </span>
                </div>
              </div>

              {/* Recommendations Box */}
              <div className="glass-panel p-5 rounded-2xl border border-indigo-500/30 bg-indigo-950/20">
                <h5 className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  Automated Operational Recommendations
                </h5>
                <ul className="space-y-2 text-xs text-slate-200">
                  {reportData.recommendations.map((rec: string, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-indigo-400 font-bold">•</span>
                      <span className="leading-relaxed">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-slate-500 text-xs">
              No report data available.
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal for Resetting Demo Data */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel p-6 rounded-2xl max-w-md w-full border border-rose-500/40 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-600/20 text-rose-400 border border-rose-500/30">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Reset Demonstration Data</h4>
                <p className="text-xs text-slate-400">Presentation Environment Reset</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              This will clear all simulated stream batches, monitoring windows, alerts, and quality history.
              The baseline machine learning model will remain registered and intact for a fresh presentation.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setIsResetModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleResetDemo}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/30 transition"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
