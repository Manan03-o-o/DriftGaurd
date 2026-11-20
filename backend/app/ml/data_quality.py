import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional


def evaluate_data_quality(
    df: pd.DataFrame,
    feature_schema: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Performs comprehensive data quality audit on an incoming dataset or batch
    against the model's registered feature schema.
    """
    n_rows = len(df)
    validation_errors: List[str] = []

    if n_rows == 0:
        return {
            "records_count": 0,
            "overall_score": 0.0,
            "missing_values_count": 0,
            "missing_percentage": 0.0,
            "duplicate_rows_count": 0,
            "outlier_count": 0,
            "schema_valid": False,
            "validation_errors": ["Incoming dataset contains 0 records."],
            "feature_scores": {}
        }

    all_expected_features = feature_schema.get("all_features", [])
    numerical_features = feature_schema.get("numerical_features", [])
    categorical_features = feature_schema.get("categorical_features", [])
    feature_stats = feature_schema.get("feature_stats", {})
    categorical_categories = feature_schema.get("categorical_categories", {})

    # 1. Schema check
    missing_cols = [c for c in all_expected_features if c not in df.columns]
    extra_cols = [c for c in df.columns if c not in all_expected_features and c not in ["default", "target", "class", "id"]]
    schema_valid = len(missing_cols) == 0

    if missing_cols:
        validation_errors.append(f"Schema mismatch: missing expected features {missing_cols}")
    if extra_cols:
        validation_errors.append(f"Schema notice: dataset contains unexpected extra columns {extra_cols[:5]}")

    # 2. Duplicate rows check
    dup_count = int(df.duplicated().sum())
    dup_pct = (dup_count / n_rows) * 100.0
    if dup_count > 0:
        validation_errors.append(f"Found {dup_count} duplicate rows ({dup_pct:.1f}% of dataset).")

    # 3. Missing values check
    total_cells = df.size
    total_missing = int(df.isna().sum().sum())
    missing_pct = float(round((total_missing / max(1, total_cells)) * 100.0, 2))
    if missing_pct > 0.0:
        validation_errors.append(f"Missing values detected: {total_missing} cells ({missing_pct:.2f}%).")

    # 4. Feature-level audit
    feature_scores: Dict[str, Any] = {}
    total_outliers = 0

    for col in all_expected_features:
        if col not in df.columns:
            feature_scores[col] = {
                "feature": col,
                "score": 0.0,
                "missing_count": n_rows,
                "missing_pct": 100.0,
                "outlier_count": 0,
                "outlier_pct": 0.0,
                "invalid_range_count": 0,
                "unexpected_categories": [],
                "status": "MISSING_COLUMN"
            }
            continue

        series = df[col]
        col_missing = int(series.isna().sum())
        col_missing_pct = float(round((col_missing / n_rows) * 100.0, 2))
        col_score = 100.0 - col_missing_pct

        col_outliers = 0
        col_outlier_pct = 0.0
        invalid_range_count = 0
        unexpected_cats = []

        if col in numerical_features:
            clean_vals = series.dropna().astype(float)
            if len(clean_vals) > 0:
                # IQR Outlier Detection
                q25, q75 = np.percentile(clean_vals, [25, 75])
                iqr = q75 - q25
                lower_bound = q25 - 1.5 * iqr
                upper_bound = q75 + 1.5 * iqr
                outlier_mask = (clean_vals < lower_bound) | (clean_vals > upper_bound)
                col_outliers = int(outlier_mask.sum())
                col_outlier_pct = float(round((col_outliers / len(clean_vals)) * 100.0, 2))
                total_outliers += col_outliers

                # Min-max range validation
                base_min = feature_stats.get(col, {}).get("min")
                base_max = feature_stats.get(col, {}).get("max")
                if base_min is not None and base_max is not None:
                    # Allow 15% margin beyond baseline historical min/max
                    range_span = max(1.0, base_max - base_min)
                    margin = range_span * 0.15
                    range_mask = (clean_vals < (base_min - margin)) | (clean_vals > (base_max + margin))
                    invalid_range_count = int(range_mask.sum())
                    if invalid_range_count > 0:
                        validation_errors.append(
                            f"Numerical anomaly in '{col}': {invalid_range_count} values outside historical range [{base_min:.1f}, {base_max:.1f}]."
                        )

                # Deduct score for outliers and invalid ranges
                col_score -= (col_outlier_pct * 0.4)
                col_score -= min(25.0, (invalid_range_count / len(clean_vals)) * 30.0)

        elif col in categorical_features:
            clean_series = series.dropna().astype(str)
            known_cats = categorical_categories.get(col, [])
            if known_cats and len(clean_series) > 0:
                unexpected_mask = ~clean_series.isin(known_cats)
                unexpected_count = int(unexpected_mask.sum())
                if unexpected_count > 0:
                    unexpected_cats = list(clean_series[unexpected_mask].unique())[:5]
                    validation_errors.append(
                        f"Unexpected category in '{col}': {unexpected_cats} (unseen in baseline training schema)."
                    )
                    col_score -= min(40.0, (unexpected_count / len(clean_series)) * 50.0)

        col_score = float(round(max(0.0, min(100.0, col_score)), 1))
        feature_scores[col] = {
            "feature": col,
            "score": col_score,
            "missing_count": col_missing,
            "missing_pct": col_missing_pct,
            "outlier_count": col_outliers,
            "outlier_pct": col_outlier_pct,
            "invalid_range_count": invalid_range_count,
            "unexpected_categories": unexpected_cats,
            "status": "EXCELLENT" if col_score >= 90 else "ACCEPTABLE" if col_score >= 70 else "DEGRADED"
        }

    # 5. Composite overall score
    avg_feat_score = float(np.mean([s["score"] for s in feature_scores.values()])) if feature_scores else 100.0
    duplicate_penalty = min(15.0, dup_pct * 0.75)
    schema_penalty = 25.0 if not schema_valid else 0.0

    overall_score = float(round(max(0.0, min(100.0, avg_feat_score - duplicate_penalty - schema_penalty)), 1))

    return {
        "records_count": n_rows,
        "overall_score": overall_score,
        "missing_values_count": total_missing,
        "missing_percentage": missing_pct,
        "duplicate_rows_count": dup_count,
        "outlier_count": total_outliers,
        "schema_valid": schema_valid,
        "validation_errors": validation_errors,
        "feature_scores": feature_scores
    }
