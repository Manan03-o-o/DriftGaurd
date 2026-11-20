import datetime
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from app.database.models import (
    ModelRegistration,
    MonitoringWindow,
    ModelQualitySnapshot,
    Alert,
    Experiment,
    DataQualityAudit
)


class ReportService:
    @staticmethod
    def generate_comprehensive_report(db: Session, model_id: str) -> Dict[str, Any]:
        model = db.query(ModelRegistration).filter(ModelRegistration.id == model_id).first()
        if not model:
            raise ValueError(f"Model '{model_id}' not found")

        windows = db.query(MonitoringWindow).filter(MonitoringWindow.model_id == model_id).order_by(MonitoringWindow.created_at.desc()).limit(20).all()
        snapshots = db.query(ModelQualitySnapshot).filter(ModelQualitySnapshot.model_id == model_id).order_by(ModelQualitySnapshot.created_at.desc()).limit(10).all()
        alerts = db.query(Alert).filter(Alert.model_id == model_id).order_by(Alert.created_at.desc()).limit(25).all()
        experiments = db.query(Experiment).filter(Experiment.model_id == model_id).order_by(Experiment.created_at.desc()).limit(5).all()
        quality_audits = db.query(DataQualityAudit).filter(DataQualityAudit.model_id == model_id).order_by(DataQualityAudit.created_at.desc()).limit(5).all()

        latest_quality = snapshots[0] if snapshots else None
        latest_audit = quality_audits[0] if quality_audits else None
        latest_window = windows[0] if windows else None

        # Calculate statistics
        total_windows = len(windows)
        drifted_windows = sum(1 for w in windows if w.overall_drift_status in ["MEDIUM", "HIGH"])
        avg_psi = float(round(sum(w.overall_psi for w in windows) / max(1, total_windows), 4)) if windows else 0.0

        # Frequently drifted features
        feat_drift_counts: Dict[str, int] = {}
        for w in windows:
            if isinstance(w.feature_results, dict):
                for f, res in w.feature_results.items():
                    if isinstance(res, dict) and res.get("drift_detected"):
                        feat_drift_counts[f] = feat_drift_counts.get(f, 0) + 1

        top_drifted = sorted(feat_drift_counts.items(), key=lambda x: x[1], reverse=True)[:5]

        # Recent alerts summary
        crit_alerts = sum(1 for a in alerts if a.severity == "CRITICAL")
        high_alerts = sum(1 for a in alerts if a.severity == "HIGH")

        # Academic recommendation logic
        recommendations = []
        if latest_quality and latest_quality.delta_f1_baseline < -0.05:
            recommendations.append(
                f"CRITICAL RETRAINING ADVISORY: Active model predictive performance exhibits Macro-F1 degradation "
                f"({latest_quality.delta_f1_baseline:+.4f} vs baseline). Deploy candidate model via Gated Retraining."
            )
        elif drifted_windows > 0:
            recommendations.append(
                f"MONITORING ADVISORY: Input covariate shift detected in {drifted_windows} of {total_windows} windows. "
                "Monitor delayed ground-truth outcomes to verify whether degradation occurs."
            )
        else:
            recommendations.append(
                "STABLE OPERATIONAL STATUS: Model predictions and feature distributions remain within baseline control tolerances."
            )

        if latest_audit and latest_audit.overall_score < 80:
            recommendations.append(
                f"DATA QUALITY WARNING: Latest ingestion audit scored {latest_audit.overall_score:.1f}%. "
                "Investigate missingness and numerical outliers before triggering automated retraining."
            )

        return {
            "metadata": {
                "report_id": f"REP-{model.id[:8]}-{datetime.datetime.now().strftime('%Y%m%d%H%M')}",
                "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "platform": "DriftGuard MLOps Platform v2.0",
                "purpose": "Final Engineering Evaluation Audit"
            },
            "model_overview": {
                "id": model.id,
                "name": model.name,
                "version": model.version,
                "algorithm": model.algorithm,
                "dataset_name": model.dataset_name,
                "is_active": model.is_active,
                "baseline_f1": model.baseline_metrics.get("primary_f1", 0.0),
                "baseline_accuracy": model.baseline_metrics.get("primary_accuracy", 0.0),
                "feature_count": model.feature_schema.get("feature_count", 0),
                "created_at": model.created_at.isoformat() if model.created_at else None
            },
            "monitoring_summary": {
                "total_windows_analyzed": total_windows,
                "drifted_windows_count": drifted_windows,
                "average_psi": avg_psi,
                "latest_window_status": latest_window.overall_drift_status if latest_window else "NONE",
                "top_drifted_features": [{"feature": f, "occurrences": c} for f, c in top_drifted]
            },
            "data_quality_summary": {
                "latest_score": latest_audit.overall_score if latest_audit else 100.0,
                "records_count": latest_audit.records_count if latest_audit else 0,
                "missing_percentage": latest_audit.missing_percentage if latest_audit else 0.0,
                "duplicate_count": latest_audit.duplicate_rows_count if latest_audit else 0,
                "outlier_count": latest_audit.outlier_count if latest_audit else 0
            },
            "predictive_quality": {
                "latest_macro_f1": latest_quality.f1_macro if latest_quality else model.baseline_metrics.get("primary_f1", 0.0),
                "delta_f1": latest_quality.delta_f1_baseline if latest_quality else 0.0,
                "latest_accuracy": latest_quality.accuracy if latest_quality else model.baseline_metrics.get("primary_accuracy", 0.0),
                "labeled_batches_count": len(snapshots)
            },
            "alerts_summary": {
                "total_alerts": len(alerts),
                "critical_count": crit_alerts,
                "high_count": high_alerts,
                "recent_alerts": [
                    {
                        "severity": a.severity,
                        "title": a.title,
                        "action": a.recommended_action,
                        "timestamp": a.created_at.isoformat() if a.created_at else ""
                    }
                    for a in alerts[:6]
                ]
            },
            "retraining_benchmarks": [
                {
                    "title": e.title,
                    "scenario": e.scenario,
                    "rankings": e.policy_comparison.get("policy_rankings", [])
                }
                for e in experiments[:3]
            ],
            "recommendations": recommendations
        }
