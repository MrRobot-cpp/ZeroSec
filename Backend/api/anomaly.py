"""
Anomaly Detection API
Exposes endpoints for training the anomaly model, querying scores,
checking status, and injecting synthetic data for demo/testing.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from backend.utils.rbac import require_any_role, get_current_organization_id
from backend.database.models import AnomalyScore
from backend.database.db import db

anomaly_bp = Blueprint('anomaly', __name__, url_prefix='/api/anomaly')


# ---------------------------------------------------------------------------
# POST /api/anomaly/train
# ---------------------------------------------------------------------------

@anomaly_bp.route('/train', methods=['POST'])
@jwt_required()
@require_any_role('Admin', 'Super Admin')
def train():
    """
    Train the anomaly model on the current org's audit logs.
    Compares Isolation Forest, LOF, and Z-Score; selects best F1.
    Also scores all historical logs and writes AnomalyScore rows.
    """
    from backend.security.anomaly_detection import get_detector
    from backend.utils.audit import get_audit_logs

    org_id = get_current_organization_id()
    logs   = get_audit_logs(organization_id=org_id, limit=10_000)

    result = get_detector().train(logs)

    if result.get('status') == 'cold_start':
        return jsonify(result), 422
    if result.get('status') == 'error':
        return jsonify(result), 500

    # After training, score all logs and persist AnomalyScore rows
    scored = _score_and_persist(org_id, logs, get_detector())
    result['scored'] = scored

    return jsonify(result), 200


# ---------------------------------------------------------------------------
# GET /api/anomaly/scores
# ---------------------------------------------------------------------------

@anomaly_bp.route('/scores', methods=['GET'])
@jwt_required()
def get_scores():
    """
    Return anomalous audit events above a given threshold.

    Query params:
      threshold  float  0.0–1.0  (default 0.60)
      limit      int             (default 50)
    """
    org_id    = get_current_organization_id()
    threshold = float(request.args.get('threshold', 0.60))
    limit     = int(request.args.get('limit', 50))

    rows = (
        AnomalyScore.query
        .filter(
            AnomalyScore.organization_id == org_id,
            AnomalyScore.anomaly_score   >= threshold,
            AnomalyScore.is_anomaly      == True,
        )
        .order_by(AnomalyScore.anomaly_score.desc())
        .limit(limit)
        .all()
    )

    scores = [
        {
            'score_id':      r.score_id,
            'audit_id':      r.audit_id,
            'user_id':       r.user_id,
            'anomaly_score': round(r.anomaly_score, 4),
            'anomaly_type':  r.anomaly_type,
            'is_anomaly':    r.is_anomaly,
            'model_version': r.model_version,
            'scored_at':     r.scored_at.isoformat() if r.scored_at else None,
        }
        for r in rows
    ]
    return jsonify({'scores': scores, 'count': len(scores)}), 200


# ---------------------------------------------------------------------------
# GET /api/anomaly/status
# ---------------------------------------------------------------------------

@anomaly_bp.route('/status', methods=['GET'])
@jwt_required()
def status():
    """Return model readiness, training metadata, evaluation metrics, and baseline."""
    from backend.security.anomaly_detection import get_anomaly_model_status

    org_id       = get_current_organization_id()
    model_status = get_anomaly_model_status()

    # Count high-confidence anomalies in DB for this org
    high_anomalies = AnomalyScore.query.filter(
        AnomalyScore.organization_id == org_id,
        AnomalyScore.anomaly_score   >= 0.75,
        AnomalyScore.is_anomaly      == True,
    ).count()

    return jsonify({
        **model_status,
        'high_anomalies': high_anomalies,
    }), 200


# ---------------------------------------------------------------------------
# POST /api/anomaly/inject-synthetic
# ---------------------------------------------------------------------------

@anomaly_bp.route('/inject-synthetic', methods=['POST'])
@jwt_required()
@require_any_role('Admin', 'Super Admin')
def inject_synthetic():
    """
    Insert synthetic AuditLog rows for demo / cold-start bypass.
    Does NOT auto-train — call /train afterwards.

    Body (JSON):
      org_id      int  (default: current org)
      n_normal    int  (default 150)
      n_anomalous int  (default 20)
    """
    from backend.scripts.generate_synthetic_audit import generate_and_insert
    from backend.database.models import User

    data        = request.get_json() or {}
    org_id      = data.get('org_id') or get_current_organization_id()
    n_normal    = int(data.get('n_normal', 150))
    n_anomalous = int(data.get('n_anomalous', 20))

    # Fetch real user IDs for this org
    users    = User.query.filter_by(organization_id=org_id).all()
    user_ids = [u.user_id for u in users] if users else [1, 2, 3]

    try:
        result = generate_and_insert(org_id, user_ids,
                                      n_normal=n_normal,
                                      n_anomalous=n_anomalous)
        return jsonify(result), 200
    except Exception as exc:
        return jsonify({'error': str(exc)}), 500


# ---------------------------------------------------------------------------
# Internal helper
# ---------------------------------------------------------------------------

def _score_and_persist(org_id: int, logs: list, detector) -> int:
    """
    Score all historical logs and write/update AnomalyScore rows.
    Returns the number of rows written.
    """
    if not detector.is_ready() or not logs:
        return 0

    scores = detector.score_batch(logs)
    written = 0

    for log, score in zip(logs, scores):
        audit_id = log.get('audit_id')
        if audit_id is None:
            continue
        is_anomaly = score >= detector.ANOMALY_THRESHOLD

        # Re-derive anomaly type from score only (no live window at batch time)
        if score >= 0.90:
            anomaly_type = 'High confidence anomaly'
        elif score >= 0.75:
            anomaly_type = 'Suspicious behavior'
        elif is_anomaly:
            anomaly_type = 'Unusual activity pattern'
        else:
            anomaly_type = None

        existing = AnomalyScore.query.filter_by(audit_id=audit_id).first()
        if existing:
            existing.anomaly_score = score
            existing.is_anomaly    = is_anomaly
            existing.anomaly_type  = anomaly_type
        else:
            db.session.add(AnomalyScore(
                audit_id=audit_id,
                organization_id=org_id,
                user_id=log.get('user_id'),
                anomaly_score=score,
                anomaly_type=anomaly_type,
                is_anomaly=is_anomaly,
                model_version=detector._model_name,
            ))
        written += 1

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return 0

    return written
