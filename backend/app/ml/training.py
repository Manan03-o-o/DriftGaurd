import os
import joblib
import numpy as np
import pandas as pd
from typing import Dict, Any, Tuple, Optional
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, HistGradientBoostingClassifier
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, average_precision_score, confusion_matrix
)
from app.core.config import settings
from app.core.logging import logger


def build_pipeline(
    numerical_cols: list[str],
    categorical_cols: list[str],
    algorithm: str = "random_forest",
    random_seed: int = 42
) -> Pipeline:
    """
    Constructs a scikit-learn Pipeline with proper feature encoding and scaling
    to strictly prevent data leakage across splits.
    """
    transformers = []
    
    if numerical_cols:
        num_transformer = Pipeline(steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler())
        ])
        transformers.append(("num", num_transformer, numerical_cols))
        
    if categorical_cols:
        cat_transformer = Pipeline(steps=[
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False))
        ])
        transformers.append(("cat", cat_transformer, categorical_cols))

    preprocessor = ColumnTransformer(transformers=transformers, remainder="drop")

    # Select classification algorithm
    if algorithm == "logistic_regression":
        classifier = LogisticRegression(
            random_state=random_seed,
            max_iter=1000,
            class_weight="balanced"
        )
    elif algorithm == "hist_gradient_boosting":
        classifier = HistGradientBoostingClassifier(
            random_state=random_seed,
            max_iter=100,
            class_weight="balanced"
        )
    else:  # default random_forest
        classifier = RandomForestClassifier(
            n_estimators=100,
            max_depth=7,
            random_state=random_seed,
            class_weight="balanced",
            n_jobs=1
        )

    pipeline = Pipeline(steps=[
        ("preprocessor", preprocessor),
        ("classifier", classifier)
    ])
    return pipeline


def evaluate_predictions(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    y_prob: Optional[np.ndarray] = None
) -> Dict[str, Any]:
    """
    Computes standard academic classification metrics.
    """
    metrics = {
        "accuracy": float(round(accuracy_score(y_true, y_pred), 4)),
        "precision": float(round(precision_score(y_true, y_pred, zero_division=0), 4)),
        "recall": float(round(recall_score(y_true, y_pred, zero_division=0), 4)),
        "f1_macro": float(round(f1_score(y_true, y_pred, average="macro", zero_division=0), 4)),
        "confusion_matrix": confusion_matrix(y_true, y_pred).tolist()
    }
    
    if y_prob is not None:
        try:
            metrics["roc_auc"] = float(round(roc_auc_score(y_true, y_prob), 4))
        except Exception:
            metrics["roc_auc"] = None
        try:
            metrics["pr_auc"] = float(round(average_precision_score(y_true, y_prob), 4))
        except Exception:
            metrics["pr_auc"] = None
    else:
        metrics["roc_auc"] = None
        metrics["pr_auc"] = None

    return metrics


def train_baseline_model(
    df: pd.DataFrame,
    target_col: str = "default",
    algorithm: str = "random_forest",
    random_seed: int = 42,
    test_size: float = 0.20,
    val_size: float = 0.20
) -> Tuple[Pipeline, Dict[str, Any], Dict[str, Any]]:
    """
    Trains a baseline model on train split, tunes/evaluates on val split,
    and returns (pipeline, schema_info, baseline_metrics).
    """
    X = df.drop(columns=[target_col])
    y = df[target_col].values

    # Detect numerical vs categorical features
    numerical_cols = X.select_dtypes(include=["int64", "float64", "int32", "float32"]).columns.tolist()
    categorical_cols = X.select_dtypes(include=["object", "string", "category", "bool"]).columns.tolist()

    schema_info = {
        "target_col": target_col,
        "feature_count": len(X.columns),
        "numerical_features": numerical_cols,
        "categorical_features": categorical_cols,
        "all_features": list(X.columns),
        "feature_stats": {
            col: {
                "mean": float(round(X[col].mean(), 3)),
                "std": float(round(X[col].std(), 3)),
                "min": float(round(X[col].min(), 3)),
                "max": float(round(X[col].max(), 3)),
                "median": float(round(X[col].median(), 3))
            } for col in numerical_cols
        },
        "categorical_categories": {
            col: list(X[col].unique()) for col in categorical_cols
        }
    }

    # Stratified Train/Val/Test separation
    X_train_val, X_test, y_train_val, y_test = train_test_split(
        X, y, test_size=test_size, random_state=random_seed, stratify=y
    )
    val_ratio = val_size / (1.0 - test_size)
    X_train, X_val, y_train, y_val = train_test_split(
        X_train_val, y_train_val, test_size=val_ratio, random_state=random_seed, stratify=y_train_val
    )

    logger.info(f"Dataset split: Train={len(X_train)}, Val={len(X_val)}, Test={len(X_test)}")

    pipeline = build_pipeline(
        numerical_cols=numerical_cols,
        categorical_cols=categorical_cols,
        algorithm=algorithm,
        random_seed=random_seed
    )

    # Fit pipeline ONLY on train split to prevent data leakage
    pipeline.fit(X_train, y_train)

    # Evaluate on held-out validation set
    y_val_pred = pipeline.predict(X_val)
    y_val_prob = pipeline.predict_proba(X_val)[:, 1] if hasattr(pipeline, "predict_proba") else None
    val_metrics = evaluate_predictions(y_val, y_val_pred, y_val_prob)

    # Evaluate on held-out test set
    y_test_pred = pipeline.predict(X_test)
    y_test_prob = pipeline.predict_proba(X_test)[:, 1] if hasattr(pipeline, "predict_proba") else None
    test_metrics = evaluate_predictions(y_test, y_test_pred, y_test_prob)

    combined_metrics = {
        "val_metrics": val_metrics,
        "test_metrics": test_metrics,
        "primary_f1": val_metrics["f1_macro"],
        "primary_accuracy": val_metrics["accuracy"],
        "primary_roc_auc": val_metrics.get("roc_auc")
    }

    return pipeline, schema_info, combined_metrics


def save_model_artifact(pipeline: Pipeline, model_id: str) -> str:
    """
    Serializes scikit-learn pipeline to disk.
    """
    path = os.path.join(settings.ARTIFACTS_DIR, f"{model_id}.joblib")
    joblib.dump(pipeline, path)
    return path


def load_model_artifact(path: str) -> Pipeline:
    """
    Deserializes model pipeline from disk.
    """
    if not os.path.exists(path):
        raise FileNotFoundError(f"Model artifact not found at {path}")
    return joblib.load(path)
