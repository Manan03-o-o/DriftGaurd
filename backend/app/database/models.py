import datetime
import uuid
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, Text, JSON, ForeignKey
from sqlalchemy.orm import relationship
from app.database.session import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


def utc_now():
    return datetime.datetime.now(datetime.timezone.utc)


class ModelRegistration(Base):
    __tablename__ = "model_registrations"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    name = Column(String(128), nullable=False)
    version = Column(String(32), nullable=False, default="1.0.0")
    algorithm = Column(String(64), nullable=False)
    task = Column(String(64), nullable=False, default="binary_classification")
    dataset_name = Column(String(128), nullable=False)
    feature_schema = Column(JSON, nullable=False)
    baseline_metrics = Column(JSON, nullable=False)
    artifact_path = Column(String(512), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utc_now)

    # Relationships
    stream_sessions = relationship("StreamSession", back_populates="model", cascade="all, delete-orphan")
    prediction_batches = relationship("PredictionBatch", back_populates="model", cascade="all, delete-orphan")
    monitoring_windows = relationship("MonitoringWindow", back_populates="model", cascade="all, delete-orphan")
    quality_snapshots = relationship("ModelQualitySnapshot", back_populates="model", cascade="all, delete-orphan")
    experiments = relationship("Experiment", back_populates="model", cascade="all, delete-orphan")


class StreamSession(Base):
    __tablename__ = "stream_sessions"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    name = Column(String(128), nullable=False)
    model_id = Column(String(64), ForeignKey("model_registrations.id", ondelete="CASCADE"), nullable=False)
    dataset_name = Column(String(128), nullable=False)
    scenario = Column(String(64), nullable=False)
    batch_size = Column(Integer, nullable=False, default=100)
    total_batches = Column(Integer, nullable=False, default=5)
    created_at = Column(DateTime, default=utc_now)

    model = relationship("ModelRegistration", back_populates="stream_sessions")
    batches = relationship("PredictionBatch", back_populates="stream", cascade="all, delete-orphan")


class PredictionBatch(Base):
    __tablename__ = "prediction_batches"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    stream_id = Column(String(64), ForeignKey("stream_sessions.id", ondelete="CASCADE"), nullable=True)
    model_id = Column(String(64), ForeignKey("model_registrations.id", ondelete="CASCADE"), nullable=False)
    batch_index = Column(Integer, default=0)
    records_count = Column(Integer, nullable=False)
    data_payload = Column(JSON, nullable=False)  # List of input row dicts
    predictions = Column(JSON, nullable=False)   # List of dicts: {"pred": int, "prob": float}
    ground_truth_labels = Column(JSON, nullable=True)  # List of ints/floats
    labeled_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utc_now)

    model = relationship("ModelRegistration", back_populates="prediction_batches")
    stream = relationship("StreamSession", back_populates="batches")


class MonitoringWindow(Base):
    __tablename__ = "monitoring_windows"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    model_id = Column(String(64), ForeignKey("model_registrations.id", ondelete="CASCADE"), nullable=False)
    stream_id = Column(String(64), nullable=True)
    batch_id = Column(String(64), nullable=True)
    window_name = Column(String(128), nullable=False, default="current_window")
    sample_size = Column(Integer, nullable=False)
    overall_drift_status = Column(String(32), nullable=False)  # NONE, LOW, MEDIUM, HIGH
    overall_psi = Column(Float, nullable=False, default=0.0)
    drifted_features_count = Column(Integer, nullable=False, default=0)
    total_features_count = Column(Integer, nullable=False, default=0)
    feature_results = Column(JSON, nullable=False)  # Dictionary of per-feature drift stats
    adwin_signal = Column(Boolean, default=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)

    model = relationship("ModelRegistration", back_populates="monitoring_windows")


class ModelQualitySnapshot(Base):
    __tablename__ = "model_quality_snapshots"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    model_id = Column(String(64), ForeignKey("model_registrations.id", ondelete="CASCADE"), nullable=False)
    stream_id = Column(String(64), nullable=True)
    batch_id = Column(String(64), nullable=True)
    samples_count = Column(Integer, nullable=False)
    accuracy = Column(Float, nullable=False)
    precision = Column(Float, nullable=False)
    recall = Column(Float, nullable=False)
    f1_macro = Column(Float, nullable=False)
    roc_auc = Column(Float, nullable=True)
    pr_auc = Column(Float, nullable=True)
    confusion_matrix = Column(JSON, nullable=False)
    delta_f1_baseline = Column(Float, nullable=False, default=0.0)
    created_at = Column(DateTime, default=utc_now)

    model = relationship("ModelRegistration", back_populates="quality_snapshots")


class Experiment(Base):
    __tablename__ = "experiments"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    title = Column(String(128), nullable=False)
    model_id = Column(String(64), ForeignKey("model_registrations.id", ondelete="CASCADE"), nullable=False)
    scenario = Column(String(64), nullable=False)
    config = Column(JSON, nullable=False)
    policy_comparison = Column(JSON, nullable=False)
    status = Column(String(32), default="completed")
    created_at = Column(DateTime, default=utc_now)

    model = relationship("ModelRegistration", back_populates="experiments")
