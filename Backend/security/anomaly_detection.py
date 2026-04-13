"""
ZeroSec Anomaly Detection Module
Real-time UEBA anomaly detection using the Observer Pattern.

Satisfies:
  FR-09: Real-Time Monitoring and Anomaly Detection
  FR-08: Audit Logging Integration

Architecture:
  log_audit() in audit.py notifies registered subscribers in a daemon thread.
  AnomalyDetector.on_security_event_dict() is called for every logged event.
  It maintains a sliding window, extracts 6 window-level features, scores via
  Isolation Forest + baseline deviation, and writes anomalies to DB.

Model selection:
  Three candidates are trained and evaluated on a stratified 80/20 split of
  labeled synthetic data (meta_data.anomaly_type present = anomalous):
    1. Isolation Forest   (Liu et al., 2008, ICDM)
    2. Local Outlier Factor  (Breunig et al., 2000, SIGMOD)
    3. Z-Score baseline
  Best F1 on test set is selected and saved to backend/models/audit_anomaly.pkl.
"""

from __future__ import annotations

import logging
import math
import pickle
import threading
from collections import deque, Counter
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

_MODELS_DIR = Path(__file__).resolve().parents[1] / "models"
_PICKLE_PATH = _MODELS_DIR / "audit_anomaly.pkl"

# Detection thresholds
ANOMALY_THRESHOLD   = 0.45   # lowered from 0.60 — Z-Score AUC=0.73 but F1=0 at 0.60
DEVIATION_THRESHOLD = 2.0
MAX_WINDOW_SIZE     = 100
BASELINE_ALPHA      = 0.05   # exponential smoothing rate

# Hard rule-based trigger thresholds (fire before ML score is checked)
RULE_FREQ_THRESHOLD   = 30.0  # events/min — no legitimate user exceeds this
RULE_FAILED_THRESHOLD = 0.50  # failed_ratio — brute force indicator
RULE_BURST_THRESHOLD  = 0.60  # burst_score — rapid sequential probing
RULE_MIN_EVENTS       = 10    # minimum window size before rules apply

# Action → severity mapping
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
    'user_updated':             'medium',
    'role_assigned':            'medium',
    'password_changed':         'medium',
}

_SEVERITY_SCORE = {'high': 3, 'medium': 2, 'low': 1}

_FAILED_ACTIONS = frozenset({
    'clearance_access_denied', 'abac_access_denied',
    'canary_token_triggered',  'firewall_injection_block',
    'llm_judge_block',         'pii_data_leak',
    'login_failed',            'permission_denied',
})


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

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
        severity = _ACTION_SEVERITY.get(action, 'low')
        return cls(
            id=str(d.get('id') or d.get('audit_id') or ''),
            timestamp=ts,
            eventType=action,
            userId=d.get('userId') or d.get('user_id'),
            organizationId=int(d.get('organizationId') or d.get('organization_id') or 0),
            details=d.get('details') or d.get('metadata') or d.get('meta_data') or {},
            severity=severity,
        )


@dataclass
class Anomaly:
    type: str
    confidence: float
    events: list
    timestamp: datetime


# ---------------------------------------------------------------------------
# Feature engineering  (6 window-level features)
# ---------------------------------------------------------------------------

class AuditFeatureEngineer:
    """
    Extracts a 6-dimensional feature vector from a sliding window of SecurityEvents.

    Features:
      1. event_frequency  — events per minute over window span
      2. type_entropy     — Shannon entropy of eventType distribution
      3. avg_severity     — mean severity score (high=3, medium=2, low=1)
      4. user_spike       — current user's events / mean user events in window
      5. failed_ratio     — fraction of events with denied/blocked action types
      6. burst_score      — max events in any 60-second sub-window / window size
    """

    def transform(self, window: deque) -> np.ndarray:
        events = list(window)
        n = len(events)
        if n < 2:
            return np.zeros(6)

        first_ts = events[0].timestamp
        last_ts  = events[-1].timestamp
        span_min = max((last_ts - first_ts).total_seconds() / 60.0, 1e-3)

        # 1. event_frequency
        freq = n / span_min

        # 2. type_entropy
        counter = Counter(e.eventType for e in events)
        entropy = -sum((c / n) * math.log2(c / n) for c in counter.values() if c > 0)

        # 3. avg_severity
        avg_sev = sum(_SEVERITY_SCORE.get(e.severity, 1) for e in events) / n

        # 4. user_spike
        last_user = events[-1].userId
        user_counts = Counter(e.userId for e in events)
        if len(user_counts) > 1:
            mean_user_events = sum(user_counts.values()) / len(user_counts)
            current_user_events = user_counts.get(last_user, 1)
            user_spike = current_user_events / max(mean_user_events, 1.0)
        else:
            user_spike = 1.0

        # 5. failed_ratio
        failed_ratio = sum(1 for e in events if e.eventType in _FAILED_ACTIONS) / n

        # 6. burst_score
        burst = self._burst_score(events)

        return np.array([freq, entropy, avg_sev, user_spike, failed_ratio, burst], dtype=float)

    @staticmethod
    def _burst_score(events: list) -> float:
        """
        Sliding-window count of max events within any 60-second span.
        O(n) using two pointers — does NOT assume timestamps are sorted,
        sorts a copy instead to handle out-of-order delivery from daemon threads.
        """
        if len(events) < 2:
            return 0.0
        timestamps = sorted(e.timestamp for e in events)
        n = len(timestamps)
        max_count = 1
        left = 0
        for right in range(n):
            while (timestamps[right] - timestamps[left]).total_seconds() > 60:
                left += 1
            max_count = max(max_count, right - left + 1)
        return max_count / n


# ---------------------------------------------------------------------------
# Z-Score detector (sklearn-compatible interface)
# ---------------------------------------------------------------------------

class _ZScoreDetector:
    """
    Statistical Z-Score anomaly detector with an sklearn-compatible interface.
    decision_function() returns values in the same range as Isolation Forest
    so the same score-remapping formula (0.5 - raw) works for all three models.
    """

    def __init__(self, threshold: float = 3.0):
        self.threshold = threshold
        self.mean_: Optional[np.ndarray] = None
        self.std_:  Optional[np.ndarray] = None

    def fit(self, X: np.ndarray) -> '_ZScoreDetector':
        self.mean_ = np.mean(X, axis=0)
        self.std_  = np.std(X, axis=0) + 1e-8
        return self

    def decision_function(self, X: np.ndarray) -> np.ndarray:
        """
        Returns values in approx [-0.5, 0.5]:
          z=0  → +0.5 (normal), z=6 → -0.5 (anomalous)
        Consistent with IsolationForest.decision_function() convention.
        """
        z = np.abs((X - self.mean_) / self.std_)
        max_z = np.max(z, axis=1)
        return 0.5 - np.clip(max_z / 6.0, 0.0, 1.0)

    def predict(self, X: np.ndarray) -> np.ndarray:
        scores = 0.5 - self.decision_function(X)  # back to [0,1]
        return np.where(scores >= self.threshold, -1, 1)


# ---------------------------------------------------------------------------
# Main detector
# ---------------------------------------------------------------------------

class AnomalyDetector:
    """
    Real-time anomaly detector implementing the AuditSubscriber protocol.

    Receives SecurityEvents via on_security_event_dict() called from daemon
    threads in audit.py (non-blocking observer pattern).

    Detection uses two independent signals:
      - ML score  (Isolation Forest / LOF / Z-Score, selected by best F1)
      - Baseline deviation  (Euclidean distance, exponential moving average)
    Either signal exceeding its threshold triggers an anomaly.
    """

    MAX_WINDOW_SIZE     = MAX_WINDOW_SIZE
    ANOMALY_THRESHOLD   = ANOMALY_THRESHOLD
    DEVIATION_THRESHOLD = DEVIATION_THRESHOLD
    BASELINE_ALPHA      = BASELINE_ALPHA

    def __init__(self):
        self._window:    deque   = deque(maxlen=self.MAX_WINDOW_SIZE)
        self._engineer   = AuditFeatureEngineer()
        self._model      = None
        self._model_name: Optional[str] = None
        self._scaler     = None
        self._baseline:  np.ndarray = np.zeros(6)
        self._baseline_initialized = False
        self._lock       = threading.Lock()
        self._app        = None   # Flask app reference for DB access from threads
        self._status: dict = {
            'model_ready': False,
            'trained_on':  0,
            'last_trained': None,
            'evaluation':  {},
            'best_model':  None,
        }
        self._load_model()

    # ------------------------------------------------------------------
    # Observer interface (called from daemon thread in audit.py)
    # ------------------------------------------------------------------

    def on_security_event_dict(self, event_dict: dict) -> None:
        """Entry point called by audit.py subscriber mechanism."""
        try:
            event = SecurityEvent.from_dict(event_dict)
            self.onSecurityEvent(event)
        except Exception as exc:
            logger.error("AnomalyDetector.on_security_event_dict: %s", exc)

    def onSecurityEvent(self, event: SecurityEvent) -> None:
        """
        Process one event: update window, score, alert if anomalous.
        Must NOT block — runs inside a daemon thread.
        """
        with self._lock:
            self._window.append(event)
            window_snapshot = deque(self._window)

        features     = self._engineer.transform(window_snapshot)
        rule_score   = self._rule_based_score(features, len(window_snapshot))

        if rule_score > 0:
            # Hard rule fired — skip ML entirely
            score = rule_score
        elif not self.is_ready():
            return
        else:
            score = self._score_features(features)

        deviation = self.calculateDeviation(features, self.getCurrentBaseline())

        if score > self.ANOMALY_THRESHOLD or deviation > self.DEVIATION_THRESHOLD:
            anomaly_type = self.determineAnomalyType(event, features)
            last_10      = list(window_snapshot)[-10:]
            anomaly      = Anomaly(
                type=anomaly_type,
                confidence=score,
                events=last_10,
                timestamp=datetime.now(timezone.utc),
            )
            self.sendAlert(anomaly)
            self._write_anomaly_score(event, score, anomaly_type, is_anomaly=True)
            if self.isTruePositive(anomaly):
                self.updateBaseline(features)
        else:
            self.updateBaseline(features)

    # ------------------------------------------------------------------
    # Batch detection (for historical audit logs)
    # ------------------------------------------------------------------

    def detectAnomalies(self, events: list) -> list:
        """
        Simulate the sliding window over a list of events and return
        Anomaly objects for every event that exceeds either threshold.
        """
        anomalies = []
        sim_window: deque = deque(maxlen=self.MAX_WINDOW_SIZE)
        for evt in events:
            if not isinstance(evt, SecurityEvent):
                evt = SecurityEvent.from_dict(evt)
            sim_window.append(evt)
            if len(sim_window) < 2:
                continue
            features   = self._engineer.transform(sim_window)
            rule_score = self._rule_based_score(features, len(sim_window))
            if rule_score > 0:
                score = rule_score
            elif self.is_ready():
                score = self._score_features(features)
            else:
                score = 0.0
            deviation = self.calculateDeviation(features, self.getCurrentBaseline())
            if score > self.ANOMALY_THRESHOLD or deviation > self.DEVIATION_THRESHOLD:
                anomaly_type = self.determineAnomalyType(evt, features)
                anomalies.append(Anomaly(
                    type=anomaly_type,
                    confidence=score,
                    events=list(sim_window)[-10:],
                    timestamp=evt.timestamp,
                ))
        return anomalies

    # ------------------------------------------------------------------
    # ML + baseline
    # ------------------------------------------------------------------

    def extractEventFeatures(self, window: deque) -> np.ndarray:
        return self._engineer.transform(window)

    def getCurrentBaseline(self) -> np.ndarray:
        return self._baseline.copy()

    def calculateDeviation(self, features: np.ndarray, baseline: np.ndarray) -> float:
        """Euclidean distance from baseline."""
        return float(np.linalg.norm(features - baseline))

    def _rule_based_score(self, features: np.ndarray, n_events: int) -> float:
        """
        Hard rule layer — returns 1.0 if any obvious attack signal fires,
        0.0 otherwise. Runs before the ML model so that clear-cut cases
        are never missed due to poor model calibration.

        Rules (each independently sufficient):
          - event_frequency > 30/min  (extreme burst)
          - failed_ratio > 0.50 with n >= 10  (brute force / injection probing)
          - burst_score > 0.60  (tight clustering of events)
        """
        if n_events < RULE_MIN_EVENTS:
            return 0.0
        freq         = features[0]
        failed_ratio = features[4]
        burst_score  = features[5]
        if freq > RULE_FREQ_THRESHOLD:
            return 1.0
        if failed_ratio > RULE_FAILED_THRESHOLD:
            return 1.0
        if burst_score > RULE_BURST_THRESHOLD:
            return 1.0
        return 0.0

    def isTruePositive(self, anomaly: Anomaly) -> bool:
        """
        Mid-confidence anomalies (0.55–0.80) are likely real events worth
        learning from. High-confidence ones may be attacks — don't adapt the
        baseline to attack patterns.
        """
        return 0.55 <= anomaly.confidence <= 0.80

    def updateBaseline(self, features: np.ndarray) -> None:
        """Exponential moving average towards new normal patterns."""
        if not self._baseline_initialized:
            self._baseline = features.copy()
            self._baseline_initialized = True
        else:
            self._baseline = (
                self.BASELINE_ALPHA * features
                + (1 - self.BASELINE_ALPHA) * self._baseline
            )

    # ------------------------------------------------------------------
    # Anomaly classification
    # ------------------------------------------------------------------

    def determineAnomalyType(self, event: SecurityEvent, features: np.ndarray) -> str:
        failed_ratio = features[4]
        burst_score  = features[5]
        user_spike   = features[3]
        avg_severity = features[2]
        evt_type     = event.eventType.lower()

        if 'canary' in evt_type:
            return "Canary-related anomaly"
        if failed_ratio > 0.4:
            return "Spike in failed logins"
        if burst_score > 0.3:
            return "Possible data exfiltration behavior"
        if user_spike > 3.0:
            return "Unusual access pattern"
        if avg_severity > 2.5:
            return "High severity burst"
        return "Unusual activity pattern"

    def sendAlert(self, anomaly: Anomaly) -> None:
        logger.warning(
            "ANOMALY | type=%s | confidence=%.3f | ts=%s",
            anomaly.type, anomaly.confidence,
            anomaly.timestamp.isoformat(),
        )
        if self._app is not None:
            self._trigger_alert_event(anomaly)

    # ------------------------------------------------------------------
    # Training with model selection
    # ------------------------------------------------------------------

    def train(self, audit_log_dicts: list) -> dict:
        """
        Train on historical audit logs with three-way model comparison.

        Steps:
          1. Build window-feature matrix from chronological log stream.
          2. Extract ground-truth labels from meta_data.anomaly_type.
          3. If ≥ 4 labeled anomalies: stratified 80/20 split → evaluate all models.
          4. Select best F1; retrain winner on full data.
          5. Save pickle to backend/models/audit_anomaly.pkl.
        """
        try:
            from sklearn.ensemble import IsolationForest
            from sklearn.neighbors import LocalOutlierFactor
            from sklearn.preprocessing import StandardScaler
            from sklearn.model_selection import train_test_split
            from sklearn.metrics import precision_score, recall_score, f1_score, roc_auc_score
        except ImportError as exc:
            return {'status': 'error', 'message': f'scikit-learn not installed: {exc}'}

        if len(audit_log_dicts) < 50:
            return {
                'status': 'cold_start',
                'current': len(audit_log_dicts),
                'min_required': 50,
            }

        # Sort chronologically and build feature matrix
        logs   = sorted(audit_log_dicts, key=lambda x: x.get('created_at') or '')
        events = [SecurityEvent.from_dict(l) for l in logs]

        X_list, y_list = [], []
        sim_window: deque = deque(maxlen=self.MAX_WINDOW_SIZE)
        for event, log in zip(events, logs):
            sim_window.append(event)
            if len(sim_window) < 2:
                continue
            feats = self._engineer.transform(sim_window)
            X_list.append(feats)
            md     = log.get('metadata') or log.get('meta_data') or {}
            y_list.append(1 if md and md.get('anomaly_type') else 0)

        X = np.array(X_list)
        y = np.array(y_list)

        scaler  = StandardScaler()
        X_sc    = scaler.fit_transform(X)
        n_anom  = int(y.sum())
        contam  = max(0.03, min(0.15, n_anom / len(y))) if n_anom > 0 else 0.05

        n_neighbors = min(20, max(2, len(X) // 5))

        def _make_if():
            return IsolationForest(
                n_estimators=100, max_samples='auto',
                contamination=contam, random_state=42, n_jobs=1,
            )

        def _make_lof():
            return LocalOutlierFactor(
                n_neighbors=n_neighbors, novelty=True, contamination=contam,
            )

        def _make_zscore():
            return _ZScoreDetector(threshold=3.0)

        evaluation: dict = {}
        best_f1   = -1.0
        best_name = 'IsolationForest'

        if n_anom >= 4:
            X_tr, X_te, y_tr, y_te = train_test_split(
                X_sc, y, test_size=0.20, random_state=42, stratify=y,
            )
            for name, make_fn in [
                ('IsolationForest', _make_if),
                ('LocalOutlierFactor', _make_lof),
                ('ZScore', _make_zscore),
            ]:
                try:
                    model = make_fn()
                    model.fit(X_tr)
                    raw    = model.decision_function(X_te)
                    scores = np.clip(0.5 - raw, 0.0, 1.0)
                    y_pred = (scores >= self.ANOMALY_THRESHOLD).astype(int)
                    prec   = float(precision_score(y_te, y_pred, zero_division=0))
                    rec    = float(recall_score(y_te, y_pred, zero_division=0))
                    f1     = float(f1_score(y_te, y_pred, zero_division=0))
                    try:
                        auc = float(roc_auc_score(y_te, scores))
                    except Exception:
                        auc = 0.5
                    evaluation[name] = {
                        'precision': round(prec, 4),
                        'recall':    round(rec, 4),
                        'f1':        round(f1, 4),
                        'roc_auc':   round(auc, 4),
                    }
                    logger.info("Model %s: P=%.3f R=%.3f F1=%.3f AUC=%.3f",
                                name, prec, rec, f1, auc)
                    if f1 > best_f1:
                        best_f1   = f1
                        best_name = name
                except Exception as exc:
                    logger.warning("Model %s evaluation failed: %s", name, exc)
                    evaluation[name] = {
                        'precision': 0.0, 'recall': 0.0, 'f1': 0.0, 'roc_auc': 0.5,
                    }
        else:
            logger.info(
                "Insufficient labeled anomalies (%d) for model selection — defaulting to IsolationForest.",
                n_anom,
            )
            for name in ('IsolationForest', 'LocalOutlierFactor', 'ZScore'):
                evaluation[name] = {
                    'precision': 0.0, 'recall': 0.0, 'f1': 0.0, 'roc_auc': 0.5,
                }

        logger.info("Selected model: %s (F1=%.4f)", best_name, best_f1 if best_f1 >= 0 else 0.0)

        # Retrain winner on full data
        make_fns = {
            'IsolationForest':   _make_if,
            'LocalOutlierFactor': _make_lof,
            'ZScore':             _make_zscore,
        }
        final_model = make_fns[best_name]()
        final_model.fit(X_sc)

        # Baseline = mean of normal feature vectors
        normal_X       = X[y == 0] if n_anom > 0 else X
        baseline_mean  = np.mean(normal_X, axis=0) if len(normal_X) > 0 else np.zeros(6)

        # Persist
        _MODELS_DIR.mkdir(parents=True, exist_ok=True)
        payload = {
            'model':         final_model,
            'model_name':    best_name,
            'scaler':        scaler,
            'baseline_mean': baseline_mean,
            'evaluation':    evaluation,
            'best_model':    best_name,
            'trained_on':    len(X),
            'trained_at':    datetime.now(timezone.utc).isoformat(),
            'version':       '1.0',
        }
        with open(_PICKLE_PATH, 'wb') as fh:
            pickle.dump(payload, fh)

        # Update in-memory state
        self._model      = final_model
        self._model_name = best_name
        self._scaler     = scaler
        self._baseline   = baseline_mean.copy()
        self._baseline_initialized = True
        self._status.update({
            'model_ready':  True,
            'trained_on':   len(X),
            'last_trained': payload['trained_at'],
            'evaluation':   evaluation,
            'best_model':   best_name,
        })

        return {
            'status':         'trained',
            'trained_on':     len(X),
            'best_model':     best_name,
            'evaluation':     evaluation,
            'contamination':  round(contam, 4),
            'scored':         len(X),
        }

    def score_batch(self, audit_log_dicts: list) -> list:
        """Return a list of [0,1] anomaly scores for a batch of log dicts."""
        if not self.is_ready():
            return [0.0] * len(audit_log_dicts)

        logs   = sorted(audit_log_dicts, key=lambda x: x.get('created_at') or '')
        events = [SecurityEvent.from_dict(l) for l in logs]
        scores = []
        sim_window: deque = deque(maxlen=self.MAX_WINDOW_SIZE)
        for event in events:
            sim_window.append(event)
            if len(sim_window) < 2:
                scores.append(0.0)
                continue
            scores.append(self._score_features(self._engineer.transform(sim_window)))
        return scores

    def is_ready(self) -> bool:
        if self._model is not None:
            return True
        # Pickle may have been written after server start (e.g. by a bootstrap script).
        # Try loading it now rather than requiring a server restart.
        if _PICKLE_PATH.exists():
            self._load_model()
        return self._model is not None

    def get_status(self) -> dict:
        return {
            **self._status,
            'window_size': len(self._window),
            'baseline':    self._baseline.tolist(),
        }

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _score_features(self, features: np.ndarray) -> float:
        if self._model is None or self._scaler is None:
            return 0.0
        X   = self._scaler.transform(features.reshape(1, -1))
        raw = self._model.decision_function(X)[0]
        return float(np.clip(0.5 - raw, 0.0, 1.0))

    def _load_model(self) -> None:
        if not _PICKLE_PATH.exists():
            return
        try:
            with open(_PICKLE_PATH, 'rb') as fh:
                payload = pickle.load(fh)
            self._model      = payload['model']
            self._model_name = payload.get('model_name', 'IsolationForest')
            self._scaler     = payload['scaler']
            self._baseline   = payload.get('baseline_mean', np.zeros(6))
            self._baseline_initialized = True
            self._status.update({
                'model_ready':  True,
                'trained_on':   payload.get('trained_on', 0),
                'last_trained': payload.get('trained_at'),
                'evaluation':   payload.get('evaluation', {}),
                'best_model':   payload.get('best_model', self._model_name),
            })
            logger.info("Loaded anomaly model '%s'", self._model_name)
        except Exception as exc:
            logger.warning("Failed to load anomaly model: %s", exc)

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
                    existing.is_anomaly    = is_anomaly
                    existing.anomaly_type  = anomaly_type
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
                org_id  = anomaly.events[0].organizationId if anomaly.events else 1
                user_id = anomaly.events[-1].userId if anomaly.events else None
                log_audit(
                    organization_id=org_id,
                    user_id=user_id,
                    action='anomaly_detected',
                    target_type='AnomalyDetector',
                    metadata={
                        'anomaly_type': anomaly.type,
                        'confidence':   round(anomaly.confidence, 3),
                        'event_count':  len(anomaly.events),
                    },
                )
        except Exception as exc:
            logger.error("Failed to log anomaly_detected: %s", exc)


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
    """
    Provide the Flask app object so the detector can open app contexts
    inside daemon threads (required for DB writes).
    """
    get_detector()._app = flask_app


def train_anomaly_model(org_id: int) -> dict:
    from backend.utils.audit import get_audit_logs
    logs = get_audit_logs(organization_id=org_id, limit=10_000)
    return get_detector().train(logs)


def get_anomaly_model_status() -> dict:
    return get_detector().get_status()
