import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional
from app.ml.training import evaluate_predictions
from app.core.logging import logger


def evaluate_batch_quality(
    ground_truth_labels: List[int],
    predictions: List[Dict[str, Any]],
    baseline_metrics: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Evaluates predictive performance when delayed ground-truth labels arrive.
    
    Args:
      ground_truth_labels: List of actual 0/1 binary labels.
      predictions: List of dicts, e.g. [{"pred": 1, "prob": 0.82}, ...]
      baseline_metrics: Registered baseline validation/test metrics for delta comparison.
    """
    y_true = np.array(ground_truth_labels)
    y_pred = np.array([p["pred"] for p in predictions])
    y_prob = np.array([p.get("prob", 0.5) for p in predictions]) if "prob" in predictions[0] else None

    metrics = evaluate_predictions(y_true, y_pred, y_prob)
    metrics["samples_count"] = len(y_true)

    # Class distribution breakdown
    pos_count = int(np.sum(y_true == 1))
    neg_count = int(np.sum(y_true == 0))
    metrics["class_distribution"] = {
        "positive_count": pos_count,
        "negative_count": neg_count,
        "positive_ratio": float(round(pos_count / max(1, len(y_true)), 4))
    }

    # Calculate delta against baseline metrics
    delta_f1 = 0.0
    delta_acc = 0.0
    if baseline_metrics:
        base_f1 = baseline_metrics.get("primary_f1") or baseline_metrics.get("val_metrics", {}).get("f1_macro", 0.0)
        base_acc = baseline_metrics.get("primary_accuracy") or baseline_metrics.get("val_metrics", {}).get("accuracy", 0.0)
        delta_f1 = float(round(metrics["f1_macro"] - base_f1, 4))
        delta_acc = float(round(metrics["accuracy"] - base_acc, 4))

    metrics["delta_f1_baseline"] = delta_f1
    metrics["delta_accuracy_baseline"] = delta_acc

    # Diagnostic flag
    metrics["is_degraded"] = bool(delta_f1 < -0.05)
    return metrics
