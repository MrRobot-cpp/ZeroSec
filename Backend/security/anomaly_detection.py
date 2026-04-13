"""
ZeroSec Anomaly Detection Module
Real-time NLP-based anomaly detection using the Observer Pattern.

Architecture:
  log_audit() in audit.py notifies registered subscribers in a daemon thread.
  AnomalyDetector.on_security_event_dict() is called for every logged event.
  It extracts the textual content of the log, transforms it via a TF-IDF vectorizer,
  and scores it using the best selected model (e.g., Isolation Forest).
"""

from __future__ import annotations

import logging
import pickle
import threading
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

_MODELS_DIR = Path(__file__).resolve().parents[1] / "models"
_PICKLE_PATH = _MODELS_DIR / "audit_anomaly.pkl"

# Detection threshold for the NLP model
ANOMALY_THRESHOLD = 0.55

@dataclass
class SecurityEvent:
    id: str
    timestamp: datetime
    eventType: str
    userId: Optional[int]
    organizationId: int
    details: dict = field(default_factory=dict)
    severity: str = 'low'

    @classmethod
    def from_dict(cls, d: dict) -> 'SecurityEvent':
        ts = d.get('timestamp') or d.get('created_at') or datetime.now(timezone.utc)
        if isinstance(ts, str):
            try:
                ts = datetime.fromisoformat(ts)
            except ValueError:
                ts = datetime.now(timezone.utc)
        action = d.get('eventType') or d.get('action') or 'unknown'
        return cls(
            id=str(d.get('id') or d.get('audit_id') or ''),
            timestamp=ts,
            eventType=action,
            userId=d.get('userId') or d.get('user_id'),
            organizationId=int(d.get('organizationId') or d.get('organization_id') or 0),
            details=d.get('details') or d.get('metadata') or d.get('meta_data') or {},
            severity=d.get('severity', 'low'),
        )

@dataclass
class Anomaly:
    type: str
    confidence: float
    events: list
    timestamp: datetime

class AnomalyDetector:
    """
    Real-time anomaly detector implementing the AuditSubscriber protocol.
    Uses an NLP model (TF-IDF + Scikit-Learn) to score the textual content of logs.
    """

    def __init__(self):
        self._model = None
        self._vectorizer = None
        self._model_name: Optional[str] = None
        self._lock = threading.Lock()
        self._app = None
        self._status: dict = {
            'model_ready': False,
            'trained_on': 0,
            'last_trained': None,
            'best_model': None,
        }
        self._load_model()

    def on_security_event_dict(self, event_dict: dict) -> None:
        """Entry point called by audit.py subscriber mechanism."""
        try:
            event = SecurityEvent.from_dict(event_dict)
            self.onSecurityEvent(event)
        except Exception as exc:
            logger.error("AnomalyDetector.on_security_event_dict: %s", exc)

    def onSecurityEvent(self, event: SecurityEvent) -> None:
        """Process one event: score log text and alert if anomalous."""
        # Avoid infinite loops from own anomaly events
        if event.eventType == 'anomaly_detected':
            return

        if not self.is_ready():
            return

        # Prepare text representation for the model
        # We combine the action and the stringified metadata
        details_str = json.dumps(event.details)
        log_text = f"{event.eventType}: {details_str}".lower()

        score = self._score_features(log_text)

        if score > ANOMALY_THRESHOLD:
            anomaly_type = self.determineAnomalyType(event, log_text)
            anomaly = Anomaly(
                type=anomaly_type,
                confidence=score,
                events=[event],  # Current event responsible for trigger
                timestamp=datetime.now(timezone.utc),
            )
            self.sendAlert(anomaly)
            self._write_anomaly_score(event, score, anomaly_type, is_anomaly=True)
        else:
            # Still write the score for dashboard visibility
            self._write_anomaly_score(event, score, "Normal activity", is_anomaly=False)

    def _score_features(self, text: str) -> float:
        """Pass text through TF-IDF and get anomaly score from the model."""
        if self._model is None or self._vectorizer is None:
            return 0.0
        try:
            X = self._vectorizer.transform([text])
            # For Isolation Forest, decision_function returns higher values for more normal points.
            # Our notebook uses (0.5 - raw) to map it to a [0, 1] anomaly score.
            raw = self._model.decision_function(X)[0]
            score = float(np.clip(0.5 - raw, 0.0, 1.0))
            return score
        except Exception as exc:
            logger.error("Scoring failed: %s", exc)
            return 0.0

    def determineAnomalyType(self, event: SecurityEvent, log_text: str) -> str:
        """Simple classification based on content and action."""
        ev = event.eventType.lower()
        txt = log_text.lower()
        if 'injection' in txt or 'ignore previous' in txt:
            return "Potential Prompt Injection"
        if 'bypass' in txt:
            return "Security Control Bypass Attempt"
        if 'canary' in ev:
            return "Canary Token Triggered"
        if 'access_denied' in ev:
            return "Unauthorized Access Pattern"
        return "Unusual behavioral pattern"

    def sendAlert(self, anomaly: Anomaly) -> None:
        logger.warning(
            "ANOMALY | type=%s | confidence=%.3f | ts=%s",
            anomaly.type, anomaly.confidence,
            anomaly.timestamp.isoformat(),
        )
        if self._app is not None:
            self._trigger_alert_event(anomaly)

    def is_ready(self) -> bool:
        if self._model is not None:
            return True
        if _PICKLE_PATH.exists():
            self._load_model()
        return self._model is not None

    def get_status(self) -> dict:
        return self._status

    def _load_model(self) -> None:
        if not _PICKLE_PATH.exists():
            logger.info("Anomaly model pickle not found at %s", _PICKLE_PATH)
            return
        try:
            # Try joblib if available (used in notebook), else fallback to pickle
            try:
                import joblib
                payload = joblib.load(_PICKLE_PATH)
            except ImportError:
                with open(_PICKLE_PATH, 'rb') as fh:
                    payload = pickle.load(fh)

            self._model = payload.get('model')
            self._vectorizer = payload.get('vectorizer')
            
            metadata = payload.get('metadata', {})
            self._model_name = metadata.get('selected_model_name', 'Isolation Forest')
            
            self._status.update({
                'model_ready': True,
                'trained_on': metadata.get('dataset_size', 0),
                'last_trained': datetime.now(timezone.utc).isoformat(),
                'best_model': self._model_name,
            })
            logger.info("Successfully loaded NLP anomaly model: %s", self._model_name)
        except Exception as exc:
            logger.error("Failed to load anomaly model: %s", exc)

    def _write_anomaly_score(self, event: SecurityEvent, score: float,
                               anomaly_type: str, is_anomaly: bool) -> None:
        """Write / update AnomalyScore row. Uses stored Flask app context."""
        if self._app is None or not event.id.isdigit():
            return
        audit_id = int(event.id)
        try:
            with self._app.app_context():
                from backend.database.db import db
                from backend.database.models import AnomalyScore
                existing = AnomalyScore.query.filter_by(audit_id=audit_id).first()
                if existing:
                    existing.anomaly_score = score
                    existing.is_anomaly = is_anomaly
                    existing.anomaly_type = anomaly_type
                else:
                    db.session.add(AnomalyScore(
                        audit_id=audit_id,
                        organization_id=event.organizationId,
                        user_id=event.userId,
                        anomaly_score=score,
                        anomaly_type=anomaly_type,
                        is_anomaly=is_anomaly,
                        model_version=self._model_name,
                    ))
                db.session.commit()
        except Exception as exc:
            logger.error("Failed to write AnomalyScore for audit_id=%d: %s", audit_id, exc)

    def _trigger_alert_event(self, anomaly: Anomaly) -> None:
        """Log an anomaly_detected audit event from within the Flask app context."""
        if self._app is None:
            return
        try:
            with self._app.app_context():
                from backend.utils.audit import log_audit
                org_id = anomaly.events[0].organizationId if anomaly.events else 1
                user_id = anomaly.events[-1].userId if anomaly.events else None
                log_audit(
                    organization_id=org_id,
                    user_id=user_id,
                    action='anomaly_detected',
                    target_type='AnomalyDetector',
                    metadata={
                        'anomaly_type': anomaly.type,
                        'confidence': round(anomaly.confidence, 3),
                        'event_count': len(anomaly.events),
                    },
                )
        except Exception as exc:
            logger.error("Failed to log anomaly_detected: %s", exc)

    def register_app(self, flask_app) -> None:
        self._app = flask_app

# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

_detector: Optional[AnomalyDetector] = None
_detector_lock = threading.Lock()

def get_detector() -> AnomalyDetector:
    global _detector
    if _detector is None:
        with _detector_lock:
            if _detector is None:
                _detector = AnomalyDetector()
    return _detector

def register_app(flask_app) -> None:
    get_detector().register_app(flask_app)

def get_anomaly_model_status() -> dict:
    return get_detector().get_status()
