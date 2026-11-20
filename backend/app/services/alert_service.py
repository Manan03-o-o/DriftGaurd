from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database.models import Alert, MonitoringWindow, ModelRegistration, ModelQualitySnapshot
from app.core.logging import logger


class AlertService:
    @staticmethod
    def generate_alerts_for_window(
        db: Session,
        window: MonitoringWindow,
        model: ModelRegistration
    ) -> List[Alert]:
        """
        Evaluates drift statistics in a newly analyzed window and generates
        actionable, deduplicated Smart Alerts.
        """
        created_alerts = []
        feature_results = window.feature_results or {}

        # 1. Check feature-level severe drifts
        for feat_name, res in feature_results.items():
            if not isinstance(res, dict):
                continue

            psi = float(res.get("psi", 0.0))
            drift_detected = bool(res.get("drift_detected", False))

            if psi >= 0.25 or drift_detected:
                # Deduplication check: do not recreate if same window & feature already has alert
                existing = db.query(Alert).filter(
                    Alert.model_id == model.id,
                    Alert.window_id == window.id,
                    Alert.affected_feature == feat_name
                ).first()

                if existing:
                    continue

                if psi >= 0.50:
                    severity = "CRITICAL"
                    rec_action = f"Immediate Investigation: Extreme covariate shift in '{feat_name}' (PSI = {psi:.4f} >= 0.50). Quarantine incoming stream batch and verify upstream data ingestion pipeline."
                elif psi >= 0.25:
                    severity = "HIGH"
                    rec_action = f"Action Required: High feature drift in '{feat_name}' (PSI = {psi:.4f} >= 0.25). Run validation on delayed ground truth and evaluate Gated Retraining."
                else:
                    severity = "MEDIUM"
                    rec_action = f"Notice: Statistically significant drift detected in '{feat_name}' (p-val = {res.get('raw_p_value', 0):.4f}, PSI = {psi:.4f}). Monitor subsequent streaming batches."

                alert = Alert(
                    model_id=model.id,
                    window_id=window.id,
                    stream_id=window.stream_id,
                    batch_id=window.batch_id,
                    severity=severity,
                    title=f"Data Drift Detected in '{feat_name}'",
                    message=f"Feature '{feat_name}' exhibited significant distribution shift in {window.window_name} (PSI: {psi:.4f}, KS/Chi stat: {res.get('statistic', 0):.4f}).",
                    affected_feature=feat_name,
                    metric_name="PSI",
                    metric_value=psi,
                    threshold=0.25 if severity in ["HIGH", "CRITICAL"] else 0.10,
                    recommended_action=rec_action
                )
                db.add(alert)
                created_alerts.append(alert)

        # 2. Check window-level overall drift status
        if window.overall_drift_status in ["HIGH", "MEDIUM"]:
            existing_win_alert = db.query(Alert).filter(
                Alert.model_id == model.id,
                Alert.window_id == window.id,
                Alert.affected_feature.is_(None)
            ).first()

            if not existing_win_alert:
                win_severity = "HIGH" if window.overall_drift_status == "HIGH" else "MEDIUM"
                win_alert = Alert(
                    model_id=model.id,
                    window_id=window.id,
                    stream_id=window.stream_id,
                    batch_id=window.batch_id,
                    severity=win_severity,
                    title=f"Monitoring Window {window.window_name} Flagged {window.overall_drift_status}",
                    message=f"{window.drifted_features_count} out of {window.total_features_count} features exceeded statistical drift thresholds with mean PSI {window.overall_psi:.4f}.",
                    affected_feature=None,
                    metric_name="MEAN_PSI",
                    metric_value=window.overall_psi,
                    threshold=0.20,
                    recommended_action="Execute Champion vs Challenger model comparison and benchmark automated retraining strategies in Experiment Center."
                )
                db.add(win_alert)
                created_alerts.append(win_alert)

        if created_alerts:
            db.commit()
            logger.info(f"Generated {len(created_alerts)} new alerts for model {model.name} in window {window.window_name}")

        return created_alerts

    @staticmethod
    def generate_alert_for_degradation(
        db: Session,
        snapshot: ModelQualitySnapshot,
        model: ModelRegistration
    ) -> Optional[Alert]:
        """
        Creates alert when ground truth reveals meaningful predictive quality degradation.
        """
        delta_f1 = float(snapshot.delta_f1_baseline)
        if delta_f1 >= -0.05:
            return None

        # Check existing alert for this snapshot
        existing = db.query(Alert).filter(
            Alert.model_id == model.id,
            Alert.batch_id == snapshot.batch_id,
            Alert.metric_name == "DELTA_F1"
        ).first()

        if existing:
            return existing

        severity = "CRITICAL" if delta_f1 < -0.10 else "HIGH"
        alert = Alert(
            model_id=model.id,
            window_id=None,
            stream_id=snapshot.stream_id,
            batch_id=snapshot.batch_id,
            severity=severity,
            title=f"Predictive Degradation Detected ({severity}): Delta Macro-F1 = {delta_f1:+.4f}",
            message=(
                f"Delayed ground-truth labels for batch '{snapshot.batch_id or 'current'}' reveal active Macro-F1 dropped "
                f"to {snapshot.f1_macro:.4f} (baseline was {model.baseline_metrics.get('primary_f1', 0):.4f})."
            ),
            affected_feature=None,
            metric_name="DELTA_F1",
            metric_value=delta_f1,
            threshold=-0.05,
            recommended_action=(
                "Immediate Model Retraining: Current model predictive performance has degraded significantly. "
                "Trigger Gated Retraining on accumulated recent windows to restore classification fidelity."
            )
        )
        db.add(alert)
        db.commit()
        db.refresh(alert)
        logger.warning(f"Created {severity} degradation alert for model {model.name}: Delta F1={delta_f1:+.4f}")
        return alert

    @staticmethod
    def get_alerts(
        db: Session,
        model_id: Optional[str] = None,
        severity: Optional[str] = None,
        is_resolved: Optional[bool] = None,
        limit: int = 50
    ) -> List[Alert]:
        query = db.query(Alert)
        if model_id:
            query = query.filter(Alert.model_id == model_id)
        if severity and severity.upper() != "ALL":
            query = query.filter(Alert.severity == severity.upper())
        if is_resolved is not None:
            query = query.filter(Alert.is_resolved == is_resolved)

        return query.order_by(Alert.created_at.desc()).limit(limit).all()

    @staticmethod
    def get_alert_stats(db: Session, model_id: Optional[str] = None) -> Dict[str, int]:
        query = db.query(Alert)
        if model_id:
            query = query.filter(Alert.model_id == model_id)

        all_alerts = query.all()
        stats = {
            "total_alerts": len(all_alerts),
            "unresolved_alerts": sum(1 for a in all_alerts if not a.is_resolved),
            "critical_alerts": sum(1 for a in all_alerts if a.severity == "CRITICAL" and not a.is_resolved),
            "high_alerts": sum(1 for a in all_alerts if a.severity == "HIGH" and not a.is_resolved),
            "medium_alerts": sum(1 for a in all_alerts if a.severity == "MEDIUM" and not a.is_resolved),
            "low_alerts": sum(1 for a in all_alerts if a.severity == "LOW" and not a.is_resolved),
            "info_alerts": sum(1 for a in all_alerts if a.severity == "INFO" and not a.is_resolved),
        }
        return stats

    @staticmethod
    def mark_as_read(db: Session, alert_id: str) -> Optional[Alert]:
        alert = db.query(Alert).filter(Alert.id == alert_id).first()
        if alert:
            alert.is_read = True
            db.commit()
            db.refresh(alert)
        return alert

    @staticmethod
    def resolve_alert(db: Session, alert_id: str) -> Optional[Alert]:
        alert = db.query(Alert).filter(Alert.id == alert_id).first()
        if alert:
            alert.is_resolved = True
            alert.is_read = True
            db.commit()
            db.refresh(alert)
        return alert

    @staticmethod
    def mark_all_as_read(db: Session, model_id: Optional[str] = None) -> int:
        query = db.query(Alert).filter(Alert.is_read == False)
        if model_id:
            query = query.filter(Alert.model_id == model_id)
        count = query.update({Alert.is_read: True})
        db.commit()
        return count
