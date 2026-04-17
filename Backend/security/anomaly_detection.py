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
# Threshold for baseline deviation — vectors within this L2 distance are normal
DEVIATION_THRESHOLD = 0.5

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


class AuditFeatureEngineer:
    """
    Extracts the 6-dimensional UEBA feature vector from a window of SecurityEvent objects.

    Features (index → name):
      0  event_frequency   — events per minute over the window span
      1  type_entropy      — Shannon entropy of action distribution
      2  avg_severity      — mean severity score (high=1.0, med=0.5, low=0.1)
      3  user_spike        — fraction of events from the single most active user
      4  failed_ratio      — blocked/denied events / total
      5  burst_score       — max events in any 60-second window / total
    """

    def transform(self, window) -> np.ndarray:
        """
        Transform a deque (or list) of SecurityEvent objects into a (6,) numpy array.
        Returns a zero vector for windows with fewer than 2 events.
        """
        import math
        from collections import Counter

        events = list(window)
        n = len(events)

        if n < 2:
            return np.zeros(6, dtype=float)

        # Parse timestamps from SecurityEvent objects
        timestamps = []
        for evt in events:
            ts = evt.timestamp if hasattr(evt, 'timestamp') else None
            if ts is None:
                continue
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
            return np.zeros(6, dtype=float)

        timestamps.sort()
        span_minutes = max(
            (timestamps[-1] - timestamps[0]).total_seconds() / 60.0,
            1 / 60.0,
        )

        # Feature 0: event_frequency
        event_frequency = n / span_minutes

        # Feature 1: type_entropy
        actions = [getattr(evt, 'eventType', 'unknown') for evt in events]
        counts = Counter(actions)
        total = sum(counts.values())
        type_entropy = -sum(
            (c / total) * math.log2(c / total)
            for c in counts.values() if c > 0
        )

        # Feature 2: avg_severity
        sev_scores = [
            _SEVERITY_SCORE.get(_ACTION_SEVERITY.get(a, 'low'), 0.1)
            for a in actions
        ]
        avg_severity = sum(sev_scores) / n

        # Feature 3: user_spike
        user_counts = Counter(getattr(evt, 'userId', None) for evt in events)
        user_spike = max(user_counts.values()) / n if user_counts else 0.0

        # Feature 4: failed_ratio
        failed = sum(1 for evt in events if getattr(evt, 'eventType', '') in _FAILED_ACTIONS)
        failed_ratio = failed / n

        # Feature 5: burst_score (two-pointer O(n))
        left, max_in_window = 0, 1
        for right in range(len(timestamps)):
            while (timestamps[right] - timestamps[left]).total_seconds() > 60:
                left += 1
            max_in_window = max(max_in_window, right - left + 1)
        burst_score = max_in_window / len(timestamps)

        return np.array([
            event_frequency, type_entropy, avg_severity,
            user_spike, failed_ratio, burst_score,
        ], dtype=float)


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
        self._baseline_alpha = 0.1   # exponential smoothing factor for baseline updates
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

    # ------------------------------------------------------------------
    # Baseline tracking (used by AuditFeatureEngineer-based tests)
    # ------------------------------------------------------------------

    def updateBaseline(self, features: np.ndarray) -> None:
        """Exponential moving average update of the feature baseline."""
        if self._baseline is None:
            self._baseline = np.array(features, dtype=float)
        else:
            alpha = self._baseline_alpha
            self._baseline = alpha * np.array(features, dtype=float) + (1 - alpha) * self._baseline

    def getCurrentBaseline(self) -> np.ndarray:
        """Return current baseline vector, or zeros if not yet set."""
        if self._baseline is None:
            return np.zeros(6, dtype=float)
        return self._baseline.copy()

    def calculateDeviation(self, features: np.ndarray, baseline: np.ndarray) -> float:
        """Return L2 distance between features and baseline."""
        return float(np.linalg.norm(np.array(features, dtype=float) - np.array(baseline, dtype=float)))

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

        # 1. UEBA Behavioral Path (requires scaler). For windows smaller than
        # _WINDOW_MIN the statistics are too sparse to be meaningful, so we
        # skip UEBA but still let the NLP path fire so every event gets a score.
        ueba_score = 0.0
        if self._scaler is not None and len(window_snapshot) >= self._WINDOW_MIN:
            ueba_score = self._score_batch_features(window_snapshot)

        # 2. NLP Content Path (requires vectorizer). Works on a single event.
        nlp_score = 0.0
        if self._vectorizer is not None:
            text_to_score = event.details.get('query') or event.details.get('question') or event.eventType
            nlp_score = self._score_features(text_to_score)

        # 3. Rule-based velocity/failure heuristics. Fires without any ML
        # model loaded — catches login spam, failed-auth storms, etc.
        rule_score, rule_type = self._score_rule_based(window_snapshot, event)

        # Use the highest score from available paths
        score = max(ueba_score, nlp_score, rule_score)

        if score == rule_score and rule_type:
            anomaly_type = rule_type
        else:
            anomaly_type = self.determineAnomalyType(event, event.eventType.lower())
        is_anom = score > ANOMALY_THRESHOLD

        if is_anom:
            now = datetime.now(timezone.utc)
            # Cooldown: don't fire more than once per _ALERT_COOLDOWN seconds for SYSTEM ALERTS.
            # However, we still write the score to the DB for UI visibility.
            with self._lock:
                should_alert = (self._last_alert_at is None or
                               (now - self._last_alert_at).total_seconds() >= self._ALERT_COOLDOWN)
                
                if should_alert:
                    self._last_alert_at = now
                    anomaly = Anomaly(
                        type=anomaly_type,
                        confidence=score,
                        events=[event],
                        timestamp=now,
                    )
                    self.sendAlert(anomaly)
        
        # ALWAYS write the score to the DB for UI/Logs visibility
        self._write_anomaly_score(event, score, anomaly_type, is_anomaly=is_anom)

    def _score_rule_based(self, window_snapshot, event: SecurityEvent):
        """
        Model-free anomaly heuristics driven purely by the rolling window.
        Returns (score in [0,1], human-readable type or None).

        Rules (take the max):
          - Velocity burst: many events of the same action from the same user
            within the last 60 seconds (e.g. login spam).
          - High failed-action ratio over the window.
          - Repeated identical queries (suggests automation / brute force).
        """
        if not window_snapshot:
            return 0.0, None

        now = datetime.now(timezone.utc)
        window_60s = []
        for ed in window_snapshot:
            ts = ed.get('timestamp')
            if isinstance(ts, str):
                try:
                    ts = datetime.fromisoformat(ts)
                except ValueError:
                    continue
            if isinstance(ts, datetime):
                if ts.tzinfo is None:
                    ts = ts.replace(tzinfo=timezone.utc)
                if (now - ts).total_seconds() <= 60:
                    window_60s.append(ed)

        best_score, best_type = 0.0, None

        # Rule A: same user + same action velocity burst
        same_user_action = [
            ed for ed in window_60s
            if ed.get('user_id') == event.userId
            and ed.get('action') == event.eventType
        ]
        if len(same_user_action) >= 5:
            score = min(1.0, 0.55 + 0.05 * (len(same_user_action) - 5))
            if score > best_score:
                best_score, best_type = score, f"Velocity burst: {event.eventType} x{len(same_user_action)} / 60s"

        # Rule B: failed-action ratio over the full window
        failed = sum(1 for ed in window_snapshot if ed.get('action') in _FAILED_ACTIONS)
        total = len(window_snapshot)
        if total >= 5 and failed / total > 0.4:
            score = min(1.0, 0.60 + (failed / total) * 0.4)
            if score > best_score:
                best_score, best_type = score, "High failure rate / probing"

        # Rule C: repeated identical query text
        q = (event.details.get('query') or event.details.get('question') or '').strip().lower()
        if q:
            repeats = sum(
                1 for ed in window_snapshot
                if (ed.get('meta_data') or {}).get('query', '').strip().lower() == q
                or (ed.get('meta_data') or {}).get('question', '').strip().lower() == q
            )
            if repeats >= 5:
                score = min(1.0, 0.55 + 0.05 * (repeats - 5))
                if score > best_score:
                    best_score, best_type = score, f"Repeated query x{repeats}"

        return best_score, best_type

    def _score_features(self, features) -> float:
        """
        Score an input against the loaded model.
        Accepts either:
          - a numpy array (6,) from AuditFeatureEngineer.transform()
          - a string for the legacy TF-IDF path
        Returns 0.0 when no model is loaded (safe default).
        """
        if self._model is None:
            return 0.0
        try:
            if isinstance(features, np.ndarray):
                # UEBA feature-vector path (scaler required)
                if self._scaler is None:
                    return 0.0
                scaled = self._scaler.transform(features.reshape(1, -1))
                raw = self._model.decision_function(scaled)[0]
                return float(np.clip(0.5 - raw, 0.0, 1.0))
            else:
                # Legacy TF-IDF text path
                if self._vectorizer is None:
                    return 0.0
                X = self._vectorizer.transform([str(features)])
                raw = self._model.decision_function(X)[0]
                return float(np.clip(0.5 - raw, 0.0, 1.0))
        except Exception as exc:
            logger.error("Scoring failed: %s", exc)
            return 0.0

    def determineAnomalyType(self, event: SecurityEvent, features_or_text) -> str:
        """
        Classify the anomaly type from event + either a feature vector or log text.
        Accepts both a numpy array (AuditFeatureEngineer output) and a plain string
        (legacy log-text path) so both call sites work.
        """
        ev = event.eventType.lower()

        # Feature-vector path: use numerical features for precise classification
        if isinstance(features_or_text, np.ndarray):
            failed_ratio = float(features_or_text[4]) if len(features_or_text) > 4 else 0.0
            burst_score  = float(features_or_text[5]) if len(features_or_text) > 5 else 0.0
            if 'canary' in ev:
                return "Canary-related anomaly"
            if failed_ratio > 0.4:
                return "Spike in failed logins"
            if burst_score > 0.5:
                return "Velocity burst detected"
            return "Unusual behavioral pattern"

        # Legacy text path
        txt = str(features_or_text).lower()
        if 'injection' in txt or 'ignore previous' in txt:
            return "Potential Prompt Injection"
        if 'bypass' in txt:
            return "Security Control Bypass Attempt"
        if 'canary' in ev:
            return "Canary-related anomaly"
        if 'access_denied' in ev:
            return "Spike in failed logins"
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
        """Write / update AnomalyScore row. Reuses active Flask app context if one exists."""
        if self._app is None or not event.id.isdigit():
            return
        audit_id = int(event.id)

        def _do_write():
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

        try:
            from flask import has_app_context
            if has_app_context():
                _do_write()
            else:
                with self._app.app_context():
                    _do_write()
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
        if len(event_dicts) < 1:
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

            if len(timestamps) < 1:
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
