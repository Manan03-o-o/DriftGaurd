import type {
  SystemStatus,
  ModelRegistration,
  StreamSession,
  DriftSummary,
  MonitoringWindow,
  ModelQualityHistory,
  ModelQualitySnapshot,
  Experiment
} from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options?.headers || {})
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (!response.ok) {
    let errorDetail = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errJson = await response.json();
      if (errJson.detail) {
        errorDetail = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
      }
    } catch (_) {
      // ignore
    }
    throw new Error(errorDetail);
  }

  return response.json();
}

export const api = {
  // System
  getHealth: () => request<{ status: string; service: string; version: string }>('/health'),
  getSystemStatus: () => request<SystemStatus>('/api/v1/system/status'),

  // Models
  getModels: () => request<ModelRegistration[]>('/api/v1/models'),
  getModel: (id: string) => request<ModelRegistration>(`/api/v1/models/${id}`),
  trainModel: (params: {
    name: string;
    version: string;
    algorithm: string;
    dataset_name: string;
    target_col: string;
    n_samples: number;
    random_seed: number;
  }) => request<ModelRegistration>('/api/v1/models/train', {
    method: 'POST',
    body: JSON.stringify(params)
  }),

  // Streams
  replayStream: (params: {
    model_id: string;
    scenario: string;
    batch_size: number;
    total_batches: number;
    random_seed: number;
    auto_analyze_drift: boolean;
  }) => request<StreamSession>('/api/v1/streams/replay', {
    method: 'POST',
    body: JSON.stringify(params)
  }),
  getStream: (streamId: string) => request<StreamSession>(`/api/v1/streams/${streamId}`),

  // Drift Monitoring
  getDriftSummary: (modelId?: string) => {
    const query = modelId ? `?model_id=${modelId}` : '';
    return request<DriftSummary>(`/api/v1/monitoring/summary${query}`);
  },
  getMonitoringHistory: (modelId?: string, limit: number = 50) => {
    const params = new URLSearchParams();
    if (modelId) params.append('model_id', modelId);
    params.append('limit', limit.toString());
    return request<MonitoringWindow[]>(`/api/v1/monitoring/history?${params.toString()}`);
  },
  analyzeDrift: (params: {
    model_id: string;
    stream_id?: string;
    batch_id?: string;
    current_data?: any[];
    window_name?: string;
    alpha?: number;
  }) => request<MonitoringWindow>('/api/v1/monitoring/analyze', {
    method: 'POST',
    body: JSON.stringify(params)
  }),

  // Labels & Quality
  attachLabels: (batchId: string, groundTruthLabels: number[]) => request<ModelQualitySnapshot>('/api/v1/labels', {
    method: 'POST',
    body: JSON.stringify({
      batch_id: batchId,
      ground_truth_labels: groundTruthLabels
    })
  }),
  getModelQualityHistory: (modelId: string) => request<ModelQualityHistory>(`/api/v1/labels/models/${modelId}/quality`),

  // Retraining Policy Experiments
  runPolicyExperiment: (params: {
    model_id: string;
    scenario: string;
    num_windows: number;
    window_size: number;
    periodic_interval: number;
    drift_psi_threshold: number;
    random_seed: number;
  }) => request<Experiment>('/api/v1/policies/evaluate', {
    method: 'POST',
    body: JSON.stringify(params)
  }),
  getExperiments: () => request<Experiment[]>('/api/v1/policies/experiments'),
  getExperiment: (id: string) => request<Experiment>(`/api/v1/policies/experiments/${id}`)
};
