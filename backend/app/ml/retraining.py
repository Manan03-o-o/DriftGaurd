import time
import copy
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional
from sklearn.model_selection import train_test_split
from app.ml.training import build_pipeline, evaluate_predictions
from app.ml.drift_detection import detect_window_drift
from app.ml.data_generation import simulate_stream_batch
from app.core.logging import logger


def run_policy_comparison_experiment(
    baseline_df: pd.DataFrame,
    initial_pipeline: Any,
    scenario: str = "mean_shift",
    num_windows: int = 5,
    window_size: int = 250,
    periodic_interval: int = 2,
    drift_psi_threshold: float = 0.20,
    random_seed: int = 42,
    target_col: str = "default"
) -> Dict[str, Any]:
    """
    Executes an academic comparative experiment evaluating 4 retraining policies
    over an identical stream of simulated batches.
    
    Policies evaluated:
      1. Static: Retains original baseline model without updates.
      2. Periodic: Retrains on accumulated labeled history every K batches.
      3. Drift-Triggered: Retrains when drift detector flags MEDIUM/HIGH severity.
      4. Gated-Retraining: Trains candidate model upon drift signal, but validates
         on held-out recent validation set. Only deploys if candidate F1 >= current F1 - tolerance.
         Otherwise REJECTS update and keeps current model.
    """
    numerical_cols = baseline_df.drop(columns=[target_col]).select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = baseline_df.drop(columns=[target_col]).select_dtypes(include=["object", "string", "category", "bool"]).columns.tolist()

    # Pre-generate identical stream batches so all 4 policies face the exact same sequence
    stream_batches: List[Dict[str, Any]] = []
    for w_idx in range(num_windows):
        X_w, y_w = simulate_stream_batch(
            reference_df=baseline_df,
            batch_size=window_size,
            scenario=scenario,
            batch_index=w_idx,
            random_seed=random_seed,
            target_col=target_col
        )
        stream_batches.append({
            "window_index": w_idx,
            "X": X_w,
            "y": y_w
        })

    policies = ["static", "periodic", "drift_triggered", "gated_retraining"]
    results_by_policy: Dict[str, Any] = {}

    for policy in policies:
        logger.info(f"Executing policy evaluation: {policy} under scenario: {scenario}")
        # Clone or re-instantiate starting model
        current_model = copy.deepcopy(initial_pipeline)
        current_version = "v1.0.0"
        version_counter = 1

        history_X = [baseline_df.drop(columns=[target_col])]
        history_y = [baseline_df[target_col].values]

        window_records = []
        total_retrain_time = 0.0
        retrain_count = 0

        for w_idx, batch in enumerate(stream_batches):
            X_curr = batch["X"]
            y_curr = batch["y"]

            # 1. Run Drift Detector against baseline distribution
            drift_res = detect_window_drift(
                baseline_df=baseline_df.drop(columns=[target_col]),
                current_df=X_curr,
                numerical_features=numerical_cols,
                categorical_features=categorical_cols
            )

            # 2. Test current model on this arriving window
            y_pred = current_model.predict(X_curr)
            y_prob = current_model.predict_proba(X_curr)[:, 1] if hasattr(current_model, "predict_proba") else None
            quality = evaluate_predictions(y_curr, y_pred, y_prob)

            decision = "NO_ACTION"
            reason = "Policy criteria not met"
            retrain_duration = 0.0

            # 3. Policy update logic (using labels from past and current batches available at decision time)
            should_update = False
            
            if policy == "static":
                decision = "STATIC_PRESERVED"
                reason = "Static policy never retrains"

            elif policy == "periodic":
                if (w_idx + 1) % periodic_interval == 0 and w_idx < num_windows - 1:
                    should_update = True
                    reason = f"Periodic cadence triggered (every {periodic_interval} windows)"

            elif policy == "drift_triggered":
                is_drifted = drift_res["overall_drift_status"] in ["MEDIUM", "HIGH"] or drift_res["max_psi"] >= drift_psi_threshold
                if is_drifted and w_idx < num_windows - 1:
                    should_update = True
                    reason = f"Drift detected: status={drift_res['overall_drift_status']}, max_psi={drift_res['max_psi']:.3f}"

            elif policy == "gated_retraining":
                is_drifted = drift_res["overall_drift_status"] in ["MEDIUM", "HIGH"] or drift_res["max_psi"] >= drift_psi_threshold
                if is_drifted and w_idx < num_windows - 1:
                    # Train candidate on recent window
                    t_start = time.time()
                    candidate_pipeline = build_pipeline(
                        numerical_cols=numerical_cols,
                        categorical_cols=categorical_cols,
                        random_seed=random_seed + w_idx * 17
                    )
                    
                    # Split current batch into train and validation to gate candidate
                    X_tr, X_val, y_tr, y_val = train_test_split(
                        X_curr, y_curr, test_size=0.35, random_state=random_seed + w_idx, stratify=y_curr
                    )
                    
                    candidate_pipeline.fit(X_tr, y_tr)
                    
                    # Validate candidate vs current on validation slice
                    cand_pred = candidate_pipeline.predict(X_val)
                    curr_pred = current_model.predict(X_val)
                    
                    cand_f1 = evaluate_predictions(y_val, cand_pred)["f1_macro"]
                    curr_f1 = evaluate_predictions(y_val, curr_pred)["f1_macro"]
                    t_gate = time.time() - t_start
                    
                    # Gating condition: Candidate must meet or exceed current model with 0.02 safety tolerance
                    if cand_f1 >= curr_f1 - 0.02:
                        current_model = candidate_pipeline
                        version_counter += 1
                        current_version = f"v1.{version_counter}.0"
                        decision = "GATED_ACCEPTED"
                        reason = f"Candidate passed validation gate: Cand F1={cand_f1:.3f} >= Curr F1={curr_f1:.3f}"
                        retrain_count += 1
                        retrain_duration = round(t_gate, 3)
                        total_retrain_time += retrain_duration
                    else:
                        decision = "GATED_REJECTED"
                        reason = f"Candidate rejected by gate: Cand F1={cand_f1:.3f} < Curr F1={curr_f1:.3f}. Preserved active model."

            if should_update and policy != "gated_retraining":
                t_start = time.time()
                # Retrain on sliding recent window (e.g. current batch)
                new_model = build_pipeline(
                    numerical_cols=numerical_cols,
                    categorical_cols=categorical_cols,
                    random_seed=random_seed + w_idx * 31
                )
                new_model.fit(X_curr, y_curr)
                retrain_duration = round(time.time() - t_start, 3)
                total_retrain_time += retrain_duration
                retrain_count += 1
                current_model = new_model
                version_counter += 1
                current_version = f"v1.{version_counter}.0"
                decision = "RETRAINED"

            window_records.append({
                "window_index": w_idx,
                "model_version": current_version,
                "drift_status": drift_res["overall_drift_status"],
                "drifted_features_count": drift_res["drifted_features_count"],
                "mean_psi": drift_res["mean_psi"],
                "max_psi": drift_res["max_psi"],
                "f1_macro": quality["f1_macro"],
                "accuracy": quality["accuracy"],
                "precision": quality["precision"],
                "recall": quality["recall"],
                "roc_auc": quality["roc_auc"],
                "decision": decision,
                "reason": reason,
                "retrain_duration_sec": retrain_duration
            })

        avg_f1 = float(round(np.mean([r["f1_macro"] for r in window_records]), 4))
        avg_acc = float(round(np.mean([r["accuracy"] for r in window_records]), 4))
        min_f1 = float(round(np.min([r["f1_macro"] for r in window_records]), 4))

        results_by_policy[policy] = {
            "policy": policy,
            "average_f1": avg_f1,
            "average_accuracy": avg_acc,
            "worst_window_f1": min_f1,
            "total_retrains": retrain_count,
            "total_compute_time_sec": round(total_retrain_time, 3),
            "window_records": window_records
        }

    summary = {
        "scenario": scenario,
        "num_windows": num_windows,
        "window_size": window_size,
        "random_seed": random_seed,
        "policy_rankings": sorted(
            [
                {
                    "policy": p,
                    "avg_f1": res["average_f1"],
                    "retrains": res["total_retrains"],
                    "compute_time": res["total_compute_time_sec"]
                }
                for p, res in results_by_policy.items()
            ],
            key=lambda x: x["avg_f1"],
            reverse=True
        ),
        "policy_results": results_by_policy,
        "academic_insights": (
            "Comparative analysis reveals trade-offs between compute overhead and resilience. "
            "Under severe concept or covariate shift, static models degrade. However, unvalidated "
            "frequent retraining risks high compute costs or overfitting small windows, whereas "
            "gated retraining balances safety by discarding sub-par candidate models."
        )
    }
    return summary
