import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional
from scipy.stats import ks_2samp, wasserstein_distance, chisquare
from app.core.logging import logger


def calculate_psi(
    baseline_series: np.ndarray,
    current_series: np.ndarray,
    num_bins: int = 10,
    epsilon: float = 1e-4
) -> float:
    """
    Computes the Population Stability Index (PSI) between a baseline feature
    and a monitoring feature window.
    
    Standard PSI Interpretation:
      - PSI < 0.10: No significant shift (Stable)
      - 0.10 <= PSI < 0.25: Moderate shift (Warning)
      - PSI >= 0.25: Significant shift (Critical Action)
    """
    baseline_clean = baseline_series[~np.isnan(baseline_series)]
    current_clean = current_series[~np.isnan(current_series)]
    
    if len(baseline_clean) == 0 or len(current_clean) == 0:
        return 0.0

    # Create quantile cutoffs on baseline to ensure balanced baseline bins
    quantiles = np.linspace(0, 100, num_bins + 1)
    bin_edges = np.percentile(baseline_clean, quantiles)
    # Deduplicate bin edges in case of low-variance or discrete values
    bin_edges = np.unique(bin_edges)
    
    if len(bin_edges) < 2:
        return 0.0
        
    bin_edges[0] = -np.inf
    bin_edges[-1] = np.inf

    # Calculate counts in each bin
    baseline_counts, _ = np.histogram(baseline_clean, bins=bin_edges)
    current_counts, _ = np.histogram(current_clean, bins=bin_edges)

    # Convert to fractions with epsilon smoothing to prevent div by 0 and log(0)
    baseline_pct = (baseline_counts + epsilon) / (np.sum(baseline_counts) + epsilon * len(baseline_counts))
    current_pct = (current_counts + epsilon) / (np.sum(current_counts) + epsilon * len(current_counts))

    # PSI formula: sum((actual - expected) * ln(actual / expected))
    psi_val = np.sum((current_pct - baseline_pct) * np.log(current_pct / baseline_pct))
    return float(round(max(0.0, psi_val), 4))


def calculate_categorical_psi(
    baseline_series: pd.Series,
    current_series: pd.Series,
    epsilon: float = 1e-4
) -> float:
    """
    Computes PSI for categorical features across discrete category levels.
    """
    all_categories = sorted(list(set(baseline_series.dropna().unique()) | set(current_series.dropna().unique())))
    if not all_categories:
        return 0.0

    b_counts = baseline_series.value_counts()
    c_counts = current_series.value_counts()

    b_total = len(baseline_series.dropna())
    c_total = len(current_series.dropna())

    if b_total == 0 or c_total == 0:
        return 0.0

    psi_val = 0.0
    for cat in all_categories:
        b_p = (b_counts.get(cat, 0) + epsilon) / (b_total + epsilon * len(all_categories))
        c_p = (c_counts.get(cat, 0) + epsilon) / (c_total + epsilon * len(all_categories))
        psi_val += (c_p - b_p) * np.log(c_p / b_p)

    return float(round(max(0.0, psi_val), 4))


def benjamini_hochberg_correction(p_values: List[float], alpha: float = 0.05) -> List[Dict[str, Any]]:
    """
    Applies the Benjamini-Hochberg (BH) procedure to control False Discovery Rate (FDR)
    across multiple hypothesis tests.
    """
    m = len(p_values)
    if m == 0:
        return []

    # Sort p-values while preserving original indices
    sorted_pairs = sorted(enumerate(p_values), key=lambda x: x[1])
    corrected_results = [None] * m

    # Calculate adjusted p-values (q-values)
    # p_adj = min(1, p * m / rank)
    q_values = [0.0] * m
    min_q = 1.0
    for rank_idx in range(m - 1, -1, -1):
        orig_idx, p_val = sorted_pairs[rank_idx]
        rank = rank_idx + 1
        q_val = min(1.0, (p_val * m) / rank)
        if q_val < min_q:
            min_q = q_val
        else:
            q_val = min_q
        q_values[rank_idx] = q_val

    for rank_idx, (orig_idx, p_val) in enumerate(sorted_pairs):
        q_val = q_values[rank_idx]
        is_significant = bool(q_val < alpha)
        corrected_results[orig_idx] = {
            "p_value": float(round(p_val, 6)),
            "q_value": float(round(q_val, 6)),
            "is_significant": is_significant
        }

    return corrected_results


class ADWINDetector:
    """
    Adaptive Windowing (ADWIN) online drift detector implementation.
    Monitors a stream of numerical signals (e.g. loss or error or prediction probabilities)
    and signals drift when the difference between sub-windows exceeds Hoeffding bounds.
    """
    def __init__(self, delta: float = 0.002, max_window: int = 1000):
        self.delta = delta
        self.max_window = max_window
        self.window: List[float] = []

    def update(self, val: float) -> bool:
        self.window.append(val)
        if len(self.window) > self.max_window:
            self.window.pop(0)

        n = len(self.window)
        if n < 30:
            return False

        # Check sub-window splits
        drift_detected = False
        # Test split points at 1/4, 1/2, 3/4
        for split in [int(n * 0.25), int(n * 0.5), int(n * 0.75)]:
            w0 = np.array(self.window[:split])
            w1 = np.array(self.window[split:])
            n0, n1 = len(w0), len(w1)
            if n0 < 10 or n1 < 10:
                continue
            
            diff = abs(np.mean(w0) - np.mean(w1))
            # Harmonic mean of window sizes
            m = 1.0 / (1.0 / n0 + 1.0 / n1)
            # Hoeffding cutoff
            eps = np.sqrt((1.0 / (2.0 * m)) * np.log(4.0 * n / self.delta))
            
            if diff > eps:
                drift_detected = True
                # Drop older subwindow upon drift
                self.window = self.window[split:]
                break

        return drift_detected


def detect_window_drift(
    baseline_df: pd.DataFrame,
    current_df: pd.DataFrame,
    numerical_features: Optional[List[str]] = None,
    categorical_features: Optional[List[str]] = None,
    alpha: float = 0.05
) -> Dict[str, Any]:
    """
    Analyzes drift between baseline distribution and a current monitoring window.
    Accounts for both statistical significance (KS test with BH correction, Chi-square)
    and practical effect sizes (PSI, Wasserstein distance, TVD).
    """
    if numerical_features is None:
        numerical_features = baseline_df.select_dtypes(include=[np.number]).columns.tolist()
    if categorical_features is None:
        categorical_features = baseline_df.select_dtypes(include=["object", "string", "category", "bool"]).columns.tolist()

    feature_results = {}
    ks_pvalues = []
    ks_feature_names = []

    # 1. Evaluate Numerical Features
    for col in numerical_features:
        if col not in current_df.columns:
            continue
        
        base_vals = baseline_df[col].dropna().values
        curr_vals = current_df[col].dropna().values

        if len(base_vals) == 0 or len(curr_vals) == 0:
            continue

        # Two-sample Kolmogorov-Smirnov test
        ks_res = ks_2samp(base_vals, curr_vals)
        ks_stat = float(round(ks_res.statistic, 4))
        ks_p = float(ks_res.pvalue)

        ks_pvalues.append(ks_p)
        ks_feature_names.append(col)

        # Wasserstein Distance (Earth Mover's Distance)
        try:
            w_dist = float(round(wasserstein_distance(base_vals, curr_vals), 4))
            # Normalized Wasserstein relative to baseline standard deviation
            std_base = float(np.std(base_vals))
            norm_w_dist = float(round(w_dist / (std_base + 1e-6), 4))
        except Exception:
            w_dist = 0.0
            norm_w_dist = 0.0

        # Population Stability Index (PSI)
        psi_val = calculate_psi(base_vals, curr_vals)

        feature_results[col] = {
            "type": "numerical",
            "test_type": "kolmogorov_smirnov",
            "statistic": ks_stat,
            "raw_p_value": ks_p,
            "psi": psi_val,
            "wasserstein_distance": w_dist,
            "normalized_wasserstein": norm_w_dist,
            "baseline_mean": float(round(np.mean(base_vals), 3)),
            "current_mean": float(round(np.mean(curr_vals), 3)),
            "mean_shift": float(round(np.mean(curr_vals) - np.mean(base_vals), 3)),
            "drift_detected": False  # Updated after multiple testing correction
        }

    # Apply Benjamini-Hochberg FDR correction across tested numerical features
    if ks_pvalues:
        bh_results = benjamini_hochberg_correction(ks_pvalues, alpha=alpha)
        for idx, col in enumerate(ks_feature_names):
            bh_info = bh_results[idx]
            feature_results[col]["bh_q_value"] = bh_info["q_value"]
            feature_results[col]["is_statistically_significant"] = bh_info["is_significant"]
            
            # Practical drift flag: Statistically significant AND meaningful effect size
            # (either PSI >= 0.10 or normalized Wasserstein >= 0.15 or KS stat >= 0.12)
            has_practical_shift = (
                feature_results[col]["psi"] >= 0.10 or
                feature_results[col]["normalized_wasserstein"] >= 0.15 or
                feature_results[col]["statistic"] >= 0.12
            )
            feature_results[col]["drift_detected"] = bool(
                bh_info["is_significant"] and has_practical_shift
            )

    # 2. Evaluate Categorical Features
    for col in categorical_features:
        if col not in current_df.columns:
            continue
        
        base_series = baseline_df[col].dropna()
        curr_series = current_df[col].dropna()

        all_cats = sorted(list(set(base_series.unique()) | set(curr_series.unique())))
        if len(all_cats) <= 1:
            continue

        b_counts = base_series.value_counts(normalize=True)
        c_counts = curr_series.value_counts(normalize=True)

        # Expected frequencies scaled to current sample size
        n_curr = len(curr_series)
        observed = [int(curr_series.value_counts().get(cat, 0)) for cat in all_cats]
        # Smooth expected to avoid 0
        expected = [max(0.5, b_counts.get(cat, 0.0) * n_curr) for cat in all_cats]
        # Normalize expected sum to observed sum
        scale_fac = sum(observed) / max(1e-6, sum(expected))
        expected = [e * scale_fac for e in expected]

        try:
            chi_res = chisquare(observed, f_exp=expected)
            chi_stat = float(round(chi_res.statistic, 4))
            chi_p = float(chi_res.pvalue)
        except Exception:
            chi_stat = 0.0
            chi_p = 1.0

        psi_val = calculate_categorical_psi(base_series, curr_series)

        # Total Variation Distance
        tvd = 0.5 * sum(abs(b_counts.get(cat, 0.0) - c_counts.get(cat, 0.0)) for cat in all_cats)

        drift_detected = bool(chi_p < alpha and (psi_val >= 0.10 or tvd >= 0.12))

        feature_results[col] = {
            "type": "categorical",
            "test_type": "chi_square",
            "statistic": chi_stat,
            "raw_p_value": chi_p,
            "bh_q_value": chi_p,
            "psi": psi_val,
            "total_variation_distance": float(round(tvd, 4)),
            "is_statistically_significant": bool(chi_p < alpha),
            "drift_detected": drift_detected
        }

    # Aggregate window-level metrics
    drifted_features = [col for col, res in feature_results.items() if res.get("drift_detected", False)]
    total_features = len(feature_results)
    drifted_count = len(drifted_features)

    # Average PSI across all features
    psi_values = [res.get("psi", 0.0) for res in feature_results.values()]
    mean_psi = float(round(np.mean(psi_values), 4)) if psi_values else 0.0
    max_psi = float(round(np.max(psi_values), 4)) if psi_values else 0.0

    # Determine Severity Category
    if drifted_count == 0 and max_psi < 0.10:
        overall_status = "NONE"
    elif (drifted_count == 1 and max_psi < 0.25) or (0.10 <= mean_psi < 0.18):
        overall_status = "LOW"
    elif (1 <= drifted_count <= 2) or (0.18 <= mean_psi < 0.30) or (0.25 <= max_psi < 0.50):
        overall_status = "MEDIUM"
    else:
        overall_status = "HIGH"

    summary = {
        "overall_drift_status": overall_status,
        "sample_size": len(current_df),
        "total_features_count": total_features,
        "drifted_features_count": drifted_count,
        "drifted_features": drifted_features,
        "mean_psi": mean_psi,
        "max_psi": max_psi,
        "feature_results": feature_results,
        "methodology_note": (
            "Multiple testing FDR controlled via Benjamini-Hochberg (alpha=0.05). "
            "Statistical significance paired with effect sizes (PSI and Wasserstein distance). "
            "IMPORTANT: Input covariate drift does not inherently prove model degradation. "
            "Check labeled performance when delayed ground-truth becomes available."
        )
    }
    return summary
