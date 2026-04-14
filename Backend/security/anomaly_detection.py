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
from collections import deque
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

_ACTION_SEVERITY: dict[str, str] = {
    'clearance_access_denied':  'high',
    'abac_access_denied':       'high',
    'canary_token_triggered':   'high',
    'firewall_injection_block': 'high',
    'llm_judge_block':          'high',
    'pii_data_leak':            'high',
    'anomaly_detected':         'high',
    'document_uploaded':        'medium',
    'document_deleted':         'medium',
    'user_created':             'medium',
    'role_assigned':            'medium',
    'password_changed':         'medium',
}
_SEVERITY_SCORE = {'high': 1.0, 'medium': 0.5, 'low': 0.1}
_FAILED_ACTIONS = {
    'clearance_access_denied', 'abac_access_denied',
    'canary_token_triggered',  'firewall_injection_block',
    'llm_judge_block',         'pii_data_leak',
}


class AnomalyDetector:
    """
    Real-time anomaly detector implementing the AuditSubscriber protocol.

    Two detection paths:
      1. Per-event NLP path (on_security_event_dict / onSecurityEvent):
         Uses TF-IDF vectorizer → IsolationForest if the pickle contains a vectorizer.
      2. Batch feature path (detectAnomalies — used by red-team simulation):
         Computes 6 numerical window features → StandardScaler → IsolationForest.
         This matches how audit_anomaly.pkl was actually trained (UEBA notebook).
    """

    # Sliding window: last N events used for real-time UEBA scoring
    _WINDOW_SIZE    = 50
    _WINDOW_MIN     = 5    # minimum events before scoring fires
    _ALERT_COOLDOWN = 60   # seconds between repeated alerts for the same session

    def __init__(self):
        self._model      = None
        self._vectorizer = None   # present only in TF-IDF pickles
        self._scaler     = None   # present in UEBA (feature-based) pickles
        self._baseline   = None   # numpy array of baseline feature means
        self._model_name: Optional[str] = None
        self._lock          = threading.Lock()
        self._window        = deque(maxlen=self._WINDOW_SIZE)  # rolling event window
        self._last_alert_at: Optional[datetime] = None          # cooldown tracker
        self._app           = None
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
        """
        Process one event in real-time.

        Adds the event to a rolling window, then scores the window using the
        UEBA feature path (scaler + IsolationForest) when enough events have
        accumulated. Only writes to AnomalyScore when a genuine anomaly fires.
        """
        # Avoid infinite loops from own anomaly bookkeeping events
        if event.eventType == 'anomaly_detected':
            return

        # Convert SecurityEvent to the dict format _score_batch_features expects
        event_dict = {
            'action':    event.eventType,
            'user_id':   event.userId,
            'timestamp': event.timestamp.isoformat() if isinstance(event.timestamp, datetime) else str(event.timestamp),
            'meta_data': event.details,
        }

        with self._lock:
            self._window.append(event_dict)
            window_snapshot = list(self._window)

        # Need minimum events for meaningful window statistics
        if len(window_snapshot) < self._WINDOW_MIN:
            return

        if not self.is_ready():
            return

        score = self._score_batch_features(window_snapshot)

        if score > ANOMALY_THRESHOLD:
            now = datetime.now(timezone.utc)
            # Cooldown: don't fire more than once per _ALERT_COOLDOWN seconds.
            # This prevents 30 identical alert rows for a single burst session.
            with self._lock:
                if (self._last_alert_at is not None and
                        (now - self._last_alert_at).total_seconds() < self._ALERT_COOLDOWN):
                    return
                self._last_alert_at = now

            anomaly_type = self.determineAnomalyType(event, event.eventType.lower())
            anomaly = Anomaly(
                type=anomaly_type,
                confidence=score,
                events=[event],
                timestamp=now,
            )
            self.sendAlert(anomaly)
            self._write_anomaly_score(event, score, anomaly_type, is_anomaly=True)
        # Do NOT write 0.0 scores — they bloat the DB and create noise in the UI.

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
            try:
                import joblib
                payload = joblib.load(_PICKLE_PATH)
            except ImportError:
                with open(_PICKLE_PATH, 'rb') as fh:
                    payload = pickle.load(fh)

            self._model      = payload.get('model')
            self._vectorizer = payload.get('vectorizer')   # TF-IDF path (may be None)
            self._scaler     = payload.get('scaler')       # UEBA feature path
            self._baseline   = payload.get('baseline_mean')

            # Support both pickle formats
            metadata         = payload.get('metadata', {})
            self._model_name = (
                payload.get('best_model')
                or metadata.get('selected_model_name')
                or 'IsolationForest'
            )

            self._status.update({
                'model_ready': True,
                'trained_on':  payload.get('trained_on') or metadata.get('dataset_size', 0),
                'last_trained': datetime.now(timezone.utc).isoformat(),
                'best_model':  self._model_name,
            })

            mode = 'TF-IDF' if self._vectorizer else 'feature-scaler (UEBA)'
            logger.info("Loaded anomaly model: %s via %s", self._model_name, mode)
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

    def _score_batch_features(self, event_dicts: list[dict]) -> float:
        """
        Compute 6 UEBA window features from a batch of events and score them
        with the scaler → IsolationForest pipeline that audit_anomaly.pkl was
        trained on.

        Features (must match the training notebook order):
          0  event_frequency   — events per minute over the session
          1  type_entropy      — Shannon entropy of action distribution
          2  avg_severity      — mean severity score (high=1.0, med=0.5, low=0.1)
          3  user_spike        — fraction of events from the single most active user
          4  failed_ratio      — blocked/denied events / total
          5  burst_score       — max events in any 60s window / total

        Returns anomaly score in [0, 1] (higher = more anomalous), 0.0 on error.
        """
        if self._model is None or self._scaler is None:
            return 0.0
        if len(event_dicts) < 2:
            return 0.0
        try:
            import math
            from collections import Counter

            # Parse timestamps
            timestamps = []
            for ed in event_dicts:
                ts = ed.get('timestamp') or ed.get('created_at')
                if isinstance(ts, str):
                    try:
                        ts = datetime.fromisoformat(ts)
                    except ValueError:
                        continue
                if isinstance(ts, datetime):
                    if ts.tzinfo is None:
                        ts = ts.replace(tzinfo=timezone.utc)
                    timestamps.append(ts)

            if len(timestamps) < 2:
                return 0.0

            timestamps.sort()
            span_minutes = max(
                (timestamps[-1] - timestamps[0]).total_seconds() / 60.0,
                1 / 60.0,   # floor at 1 second to avoid division by zero
            )
            n = len(event_dicts)

            # Feature 0: event_frequency (events/min)
            event_frequency = n / span_minutes

            # Feature 1: type_entropy
            actions = [ed.get('action', 'unknown') for ed in event_dicts]
            counts  = Counter(actions)
            total   = sum(counts.values())
            type_entropy = -sum(
                (c / total) * math.log2(c / total)
                for c in counts.values() if c > 0
            )

            # Feature 2: avg_severity
            sev_scores = [
                _SEVERITY_SCORE.get(
                    _ACTION_SEVERITY.get(ed.get('action', ''), 'low'), 0.1
                )
                for ed in event_dicts
            ]
            avg_severity = sum(sev_scores) / n

            # Feature 3: user_spike (fraction from single most active user)
            user_counts = Counter(
                ed.get('user_id') or ed.get('userId') for ed in event_dicts
            )
            user_spike = max(user_counts.values()) / n if user_counts else 0.0

            # Feature 4: failed_ratio
            failed = sum(1 for ed in event_dicts if ed.get('action') in _FAILED_ACTIONS)
            failed_ratio = failed / n

            # Feature 5: burst_score (two-pointer O(n))
            left, max_in_window = 0, 1
            for right in range(len(timestamps)):
                while (timestamps[right] - timestamps[left]).total_seconds() > 60:
                    left += 1
                max_in_window = max(max_in_window, right - left + 1)
            burst_score = max_in_window / len(timestamps)

            features = np.array([[
                event_frequency, type_entropy, avg_severity,
                user_spike, failed_ratio, burst_score,
            ]])

            scaled = self._scaler.transform(features)
            raw    = self._model.decision_function(scaled)[0]
            score  = float(np.clip(0.5 - raw, 0.0, 1.0))
            return score

        except Exception as exc:
            logger.warning("_score_batch_features failed: %s", exc)
            return 0.0

    def detectAnomalies(self, event_dicts: list[dict]) -> list['Anomaly']:
        """
        Batch simulation path used by the red-team runner.
        Three detection layers (all run independently):
          1. Velocity burst rule       — no model needed
          2. Failed-action ratio rule  — no model needed
          3. UEBA feature scoring      — uses scaler + IsolationForest from pkl

        Never writes to AuditLog or AnomalyScore — read-only.
        Returns a list of Anomaly objects for flagged events.
        """
        if not event_dicts:
            return []

        anomalies: list[Anomaly] = []

        # -- Rule 1: velocity burst check across the entire event stream --------
        # If more than 20 events arrive within any 60-second window, flag it.
        try:
            timestamps = []
            for ed in event_dicts:
                ts = ed.get('timestamp') or ed.get('created_at')
                if isinstance(ts, str):
                    try:
                        ts = datetime.fromisoformat(ts)
                    except ValueError:
                        continue
                if isinstance(ts, datetime):
                    if ts.tzinfo is None:
                        ts = ts.replace(tzinfo=timezone.utc)
                    timestamps.append(ts)

            if len(timestamps) >= 2:
                timestamps.sort()
                n = len(timestamps)
                left = 0
                max_in_window = 1
                for right in range(n):
                    while (timestamps[right] - timestamps[left]).total_seconds() > 60:
                        left += 1
                    max_in_window = max(max_in_window, right - left + 1)

                burst_ratio = max_in_window / n
                if max_in_window >= 20 or burst_ratio > 0.60:
                    # Build a representative event for the anomaly report
                    rep = SecurityEvent.from_dict(event_dicts[0])
                    anomalies.append(Anomaly(
                        type="Velocity Burst / Exfiltration Pattern",
                        confidence=min(1.0, 0.60 + burst_ratio * 0.4),
                        events=[rep],
                        timestamp=datetime.now(timezone.utc),
                    ))
        except Exception as exc:
            logger.warning("detectAnomalies burst check failed: %s", exc)

        # -- Rule 2: high failed-action ratio ------------------------------------
        try:
            failed_actions = {'firewall_injection_block', 'clearance_access_denied',
                              'abac_access_denied', 'canary_token_triggered'}
            total  = len(event_dicts)
            failed = sum(1 for ed in event_dicts if ed.get('action') in failed_actions)
            if total >= 10 and failed / total > 0.40:
                rep = SecurityEvent.from_dict(event_dicts[0])
                anomalies.append(Anomaly(
                    type="High Failure Rate / Injection Probing",
                    confidence=min(1.0, 0.55 + (failed / total) * 0.45),
                    events=[rep],
                    timestamp=datetime.now(timezone.utc),
                ))
        except Exception as exc:
            logger.warning("detectAnomalies failed-ratio check failed: %s", exc)

        # -- UEBA batch feature scoring (scaler + IsolationForest from pkl) ------
        # This is the path the pickle was actually trained on: 6 numerical window
        # features (event_frequency, type_entropy, avg_severity, user_spike,
        # failed_ratio, burst_score) scaled and passed to IsolationForest.
        if self.is_ready() and self._scaler is not None:
            try:
                model_score = self._score_batch_features(event_dicts)
                if model_score > ANOMALY_THRESHOLD:
                    rep = SecurityEvent.from_dict(event_dicts[0])
                    anomaly_type = self.determineAnomalyType(rep, rep.eventType.lower())
                    anomalies.append(Anomaly(
                        type=f"{anomaly_type} (model score {model_score:.2f})",
                        confidence=model_score,
                        events=[rep],
                        timestamp=datetime.now(timezone.utc),
                    ))
            except Exception as exc:
                logger.warning("detectAnomalies UEBA scoring failed: %s", exc)

        return anomalies

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
