import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { OverviewPage } from './pages/OverviewPage';
import { ModelsPage } from './pages/ModelsPage';
import { DriftMonitorPage } from './pages/DriftMonitorPage';
import { ExperimentCenterPage } from './pages/ExperimentCenterPage';
import { ModelQualityPage } from './pages/ModelQualityPage';
import { ReplayModal } from './components/ReplayModal';
import { TrainModelModal } from './components/TrainModelModal';
import { api } from './services/api';
import type {
  SystemStatus,
  ModelRegistration,
  DriftSummary,
  MonitoringWindow,
  ModelQualityHistory,
  Experiment,
  StreamSession
} from './types';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<string>('overview');
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [models, setModels] = useState<ModelRegistration[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [driftSummary, setDriftSummary] = useState<DriftSummary | null>(null);
  const [monitoringWindows, setMonitoringWindows] = useState<MonitoringWindow[]>([]);
  const [qualityHistory, setQualityHistory] = useState<ModelQualityHistory | null>(null);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [activeStream, setActiveStream] = useState<StreamSession | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [isReplayModalOpen, setIsReplayModalOpen] = useState<boolean>(false);
  const [isTrainModalOpen, setIsTrainModalOpen] = useState<boolean>(false);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const showError = (msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(null), 6000);
  };

  // Initial Data Fetch
  const loadInitialData = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const [status, fetchedModels] = await Promise.all([
        api.getSystemStatus().catch(() => null),
        api.getModels().catch(() => [])
      ]);

      if (status) setSystemStatus(status);
      if (fetchedModels && fetchedModels.length > 0) {
        setModels(fetchedModels);
        const active = fetchedModels.find((m) => m.is_active) || fetchedModels[0];
        setSelectedModelId(active.id);
      }
    } catch (err: any) {
      showError(`Initialization error: ${err.message}`);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Fetch data dependent on selected model
  const loadModelData = useCallback(async (modelId: string) => {
    if (!modelId) return;
    try {
      const [summary, windows, quality, exps] = await Promise.all([
        api.getDriftSummary(modelId).catch(() => null),
        api.getMonitoringHistory(modelId, 50).catch(() => []),
        api.getModelQualityHistory(modelId).catch(() => null),
        api.getExperiments().catch(() => [])
      ]);

      if (summary) setDriftSummary(summary);
      setMonitoringWindows(windows);
      if (quality) setQualityHistory(quality);
      if (exps) setExperiments(exps);
    } catch (err: any) {
      console.error('Failed to load model-specific metrics:', err);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (selectedModelId) {
      loadModelData(selectedModelId);
    }
  }, [selectedModelId, loadModelData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadInitialData();
    if (selectedModelId) {
      await loadModelData(selectedModelId);
    }
    setIsRefreshing(false);
    showSuccess('Dashboard metrics updated');
  };

  // Handler: Replay Stream Batch
  const handleReplayStream = async (params: {
    scenario: string;
    batch_size: number;
    total_batches: number;
    random_seed: number;
  }) => {
    try {
      setIsLoading(true);
      const stream = await api.replayStream({
        model_id: selectedModelId,
        ...params,
        auto_analyze_drift: true
      });
      setActiveStream(stream);
      showSuccess(`Replayed ${stream.total_batches} batches with scenario '${stream.scenario}'`);
      await loadModelData(selectedModelId);
      setCurrentTab('drift');
    } catch (err: any) {
      showError(`Stream replay failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handler: Train Baseline Model
  const handleTrainModel = async (params: {
    name: string;
    version: string;
    algorithm: string;
    dataset_name: string;
    target_col: string;
    n_samples: number;
    random_seed: number;
  }) => {
    try {
      setIsLoading(true);
      const newModel = await api.trainModel(params);
      setModels((prev) => [newModel, ...prev]);
      setSelectedModelId(newModel.id);
      showSuccess(`Trained & registered ${newModel.name} (v${newModel.version})`);
      await loadModelData(newModel.id);
      setCurrentTab('models');
    } catch (err: any) {
      showError(`Training failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handler: Run Policy Experiment
  const handleRunExperiment = async (params: {
    model_id: string;
    scenario: string;
    num_windows: number;
    window_size: number;
    periodic_interval: number;
    drift_psi_threshold: number;
    random_seed: number;
  }) => {
    try {
      setIsLoading(true);
      const exp = await api.runPolicyExperiment(params);
      setExperiments((prev) => [exp, ...prev]);
      showSuccess(`Completed retraining policy benchmark: ${exp.title}`);
      await loadModelData(params.model_id);
    } catch (err: any) {
      showError(`Policy experiment failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handler: Attach Ground Truth Labels
  const handleAttachBatchLabels = async (batchId: string, groundTruth: number[]) => {
    try {
      setIsLoading(true);
      const snapshot = await api.attachLabels(batchId, groundTruth);
      showSuccess(`Ground-truth attached to ${snapshot.samples_count} predictions. Macro-F1: ${snapshot.f1_macro.toFixed(3)}`);
      await loadModelData(selectedModelId);
    } catch (err: any) {
      showError(`Failed attaching labels: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedModel = models.find((m) => m.id === selectedModelId) || models[0] || null;

  const pageHeaders: Record<string, { title: string; subtitle: string }> = {
    overview: {
      title: 'DriftGuard Reliability Overview',
      subtitle: 'Real-time monitoring health, statistical alerts, and predictive quality audit'
    },
    models: {
      title: 'Model Inventory & Preprocessing Registry',
      subtitle: 'Leakage-safe scikit-learn pipelines, schema specifications, and validation benchmarks'
    },
    drift: {
      title: 'Statistical Drift Diagnostics & Effect Sizes',
      subtitle: 'Benjamini–Hochberg FDR corrected KS tests, decile PSI scores, and Wasserstein distance'
    },
    experiments: {
      title: 'Retraining Policy Simulation & Gated Updates',
      subtitle: 'Comparative evaluation of Static, Periodic, Drift-Triggered, and Gated-Retraining strategies'
    },
    quality: {
      title: 'Delayed Ground-Truth & Predictive Auditing',
      subtitle: 'Confusion matrices, class breakdown, and empirical degradation independent of feature shift'
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        systemStatus={systemStatus}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          title={pageHeaders[currentTab]?.title || 'DriftGuard'}
          subtitle={pageHeaders[currentTab]?.subtitle || ''}
          models={models}
          selectedModelId={selectedModelId}
          onModelSelect={setSelectedModelId}
          onRefresh={handleRefresh}
          onOpenReplayModal={() => setIsReplayModalOpen(true)}
          onOpenTrainModal={() => setIsTrainModalOpen(true)}
          isRefreshing={isRefreshing}
        />

        {/* Global Notifications */}
        <div className="px-8 pt-4">
          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-800/80 text-emerald-300 text-xs font-medium flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{successMessage}</span>
            </div>
          )}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800/80 text-rose-300 text-xs font-medium flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Page Views */}
        <main className="flex-1 p-8 overflow-y-auto">
          {currentTab === 'overview' && (
            <OverviewPage
              model={selectedModel}
              driftSummary={driftSummary}
              qualityHistory={qualityHistory}
              experiments={experiments}
              onNavigate={setCurrentTab}
              onOpenReplay={() => setIsReplayModalOpen(true)}
              onOpenExperiment={() => {
                setCurrentTab('experiments');
              }}
            />
          )}

          {currentTab === 'models' && (
            <ModelsPage
              models={models}
              selectedModel={selectedModel}
              onSelectModel={setSelectedModelId}
              onOpenTrainModal={() => setIsTrainModalOpen(true)}
            />
          )}

          {currentTab === 'drift' && (
            <DriftMonitorPage
              windows={monitoringWindows}
              onOpenReplayModal={() => setIsReplayModalOpen(true)}
            />
          )}

          {currentTab === 'experiments' && (
            <ExperimentCenterPage
              models={models}
              selectedModel={selectedModel}
              experiments={experiments}
              onRunExperiment={handleRunExperiment}
              isLoading={isLoading}
            />
          )}

          {currentTab === 'quality' && (
            <ModelQualityPage
              model={selectedModel}
              qualityHistory={qualityHistory}
              activeStream={activeStream}
              onAttachBatchLabels={handleAttachBatchLabels}
              isLoading={isLoading}
            />
          )}
        </main>
      </div>

      {/* Replay Stream Modal */}
      <ReplayModal
        isOpen={isReplayModalOpen}
        onClose={() => setIsReplayModalOpen(false)}
        onSubmit={handleReplayStream}
        isLoading={isLoading}
      />

      {/* Train Model Modal */}
      <TrainModelModal
        isOpen={isTrainModalOpen}
        onClose={() => setIsTrainModalOpen(false)}
        onSubmit={handleTrainModel}
        isLoading={isLoading}
      />
    </div>
  );
};

export default App;
