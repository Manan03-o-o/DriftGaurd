export interface ModelRegistration {
  id: string;
  name: string;
  version: string;
  algorithm: string;
  task: string;
  dataset_name: string;
  feature_schema: {
    target_col: string;
    feature_count: number;
    numerical_features: string[];
    categorical_features: string[];
    all_features: string[];
    feature_stats?: Record<string, { mean: number; std: number; min: number; max: number; median: number }>;
    categorical_categories?: Record<string, string[]>;
  };
  baseline_metrics: {
    primary_f1: number;
    primary_accuracy: number;
    primary_roc_auc?: number;
    val_metrics: {
      accuracy: number;
      precision: number;
      recall: number;
      f1_macro: number;
      roc_auc?: number;
      pr_auc?: number;
      confusion_matrix: number[][];
    };
    test_metrics: {
      accuracy: number;
      precision: number;
      recall: number;
      f1_macro: number;
      roc_auc?: number;
      pr_auc?: number;
      confusion_matrix: number[][];
    };
  };
  artifact_path: string;
  is_active: boolean;
  created_at: string;
}

export interface PredictionBatchPreview {
  id: string;
  batch_index: number;
  records_count: number;
  has_labels: boolean;
  created_at: string;
  predictions_preview: Array<{ pred: number; prob: number }>;
}

export interface StreamSession {
  id: string;
  name: string;
  model_id: string;
  dataset_name: string;
  scenario: string;
  batch_size: number;
  total_batches: number;
  created_at: string;
  batches: PredictionBatchPreview[];
}

export interface FeatureDriftResult {
  type: 'numerical' | 'categorical';
  test_type: 'kolmogorov_smirnov' | 'chi_square';
  statistic: number;
  raw_p_value: number;
  bh_q_value?: number;
  psi: number;
  wasserstein_distance?: number;
  normalized_wasserstein?: number;
  total_variation_distance?: number;
  baseline_mean?: number;
  current_mean?: number;
  mean_shift?: number;
  is_statistically_significant: boolean;
  drift_detected: boolean;
}

export interface MonitoringWindow {
  id: string;
  model_id: string;
  stream_id?: string;
  batch_id?: string;
  window_name: string;
  sample_size: number;
  overall_drift_status: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
  overall_psi: number;
  drifted_features_count: number;
  total_features_count: number;
  feature_results: Record<string, FeatureDriftResult>;
  notes?: string;
  created_at: string;
}

export interface DriftSummary {
  total_windows_analyzed: number;
  active_alerts_count: number;
  latest_window_status: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
  status_distribution: Record<string, number>;
  most_drifted_features: Array<{ feature: string; drift_occurrences: number }>;
  recent_windows: MonitoringWindow[];
}

export interface ModelQualitySnapshot {
  id: string;
  model_id: string;
  stream_id?: string;
  batch_id?: string;
  samples_count: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1_macro: number;
  roc_auc?: number;
  pr_auc?: number;
  confusion_matrix: number[][];
  delta_f1_baseline: number;
  created_at: string;
}

export interface ModelQualityHistory {
  model_id: string;
  baseline_metrics: any;
  snapshots: ModelQualitySnapshot[];
  current_status: 'HEALTHY' | 'DEGRADED' | 'CRITICALLY_DEGRADED';
}

export interface PolicyWindowRecord {
  window_index: number;
  model_version: string;
  drift_status: string;
  drifted_features_count: number;
  mean_psi: number;
  max_psi: number;
  f1_macro: number;
  accuracy: number;
  precision: number;
  recall: number;
  roc_auc?: number;
  decision: string;
  reason: string;
  retrain_duration_sec: number;
}

export interface PolicyResult {
  policy: 'static' | 'periodic' | 'drift_triggered' | 'gated_retraining';
  average_f1: number;
  average_accuracy: number;
  worst_window_f1: number;
  total_retrains: number;
  total_compute_time_sec: number;
  window_records: PolicyWindowRecord[];
}

export interface Experiment {
  id: string;
  title: string;
  model_id: string;
  scenario: string;
  config: {
    num_windows: number;
    window_size: number;
    periodic_interval: number;
    drift_psi_threshold: number;
    random_seed: number;
    model_name: string;
    dataset_name: string;
  };
  policy_comparison: {
    scenario: string;
    num_windows: number;
    window_size: number;
    random_seed: number;
    policy_rankings: Array<{
      policy: string;
      avg_f1: number;
      retrains: number;
      compute_time: number;
    }>;
    policy_results: Record<string, PolicyResult>;
    academic_insights: string;
  };
  status: string;
  created_at: string;
}

export interface SystemStatus {
  status: string;
  version: string;
  environment: string;
  database_status: string;
  registered_models_count: number;
  analyzed_windows_count: number;
  total_experiments_count: number;
  system_time: string;
  details: {
    python_version: string;
    platform: string;
    database_url_type: string;
    debug: boolean;
  };
}
