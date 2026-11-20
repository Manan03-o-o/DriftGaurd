import type {
  SystemStatus,
  ModelRegistration,
  ModelExplainability,
  ModelComparison,
  Alert,
  AlertStats,
  DataQualityAudit,
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
  resetDemoData: () => request<{ status: string; message: string }>('/api/v1/system/reset-demo', { method: 'POST' }),
  getReport: (modelId: string) => request<any>(`/api/v1/reports/model/${modelId}`),
  getReportHtmlUrl: (modelId: string) => `${API_BASE}/api/v1/reports/model/${modelId}/html`,

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
  activateModel: (id: string) => request<ModelRegistration>(`/api/v1/models/${id}/activate`, {
    method: 'POST'
  }),
  compareModels: (params: { champion_id: string; challenger_id: string; tolerance?: number }) =>
    request<ModelComparison>('/api/v1/models/compare', {
      method: 'POST',
      body: JSON.stringify(params)
    }),
  getModelExplainability: (id: string) => request<ModelExplainability>(`/api/v1/models/${id}/explainability`),

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
  getExperiment: (id: string) => request<Experiment>(`/api/v1/policies/experiments/${id}`),

  // Smart Alerts
  getAlerts: (params?: { model_id?: string; severity?: string; is_resolved?: boolean; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.model_id) q.append('model_id', params.model_id);
    if (params?.severity) q.append('severity', params.severity);
    if (params?.is_resolved !== undefined) q.append('is_resolved', params.is_resolved.toString());
    if (params?.limit) q.append('limit', params.limit.toString());
    const queryStr = q.toString() ? `?${q.toString()}` : '';
    return request<Alert[]>(`/api/v1/alerts${queryStr}`);
  },
  getAlertStats: (modelId?: string) => {
    const q = modelId ? `?model_id=${modelId}` : '';
    return request<AlertStats>(`/api/v1/alerts/stats${q}`);
  },
  markAlertRead: (id: string) => request<Alert>(`/api/v1/alerts/${id}/read`, { method: 'PATCH' }),
  resolveAlert: (id: string) => request<Alert>(`/api/v1/alerts/${id}/resolve`, { method: 'PATCH' }),
  markAllAlertsRead: (modelId?: string) => {
    const q = modelId ? `?model_id=${modelId}` : '';
    return request<{ marked_read_count: number }>(`/api/v1/alerts/read-all${q}`, { method: 'POST' });
  },

  // Data Quality
  runDataQualityAudit: (params: { model_id: string; dataset_name?: string; records?: any[] }) =>
    request<DataQualityAudit>('/api/v1/quality/audit', {
      method: 'POST',
      body: JSON.stringify(params)
    }),
  uploadDataQualityCsv: async (modelId: string, file: File): Promise<DataQualityAudit> => {
    const formData = new FormData();
    formData.append('model_id', modelId);
    formData.append('file', file);
    const url = `${API_BASE}/api/v1/quality/upload-csv`;
    const response = await fetch(url, {
      method: 'POST',
      body: formData
    });
    if (!response.ok) {
      let errStr = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const j = await response.json();
        if (j.detail) errStr = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail);
      } catch (_) {}
      throw new Error(errStr);
    }
    return response.json();
  },
  getDataQualityHistory: (modelId?: string, limit: number = 20) => {
    const q = new URLSearchParams();
    if (modelId) q.append('model_id', modelId);
    q.append('limit', limit.toString());
    return request<DataQualityAudit[]>(`/api/v1/quality/history?${q.toString()}`);
  }
};
