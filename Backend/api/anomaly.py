"""
Anomaly Detection API — runtime inference only.

Training happens offline in backend/experiments/train_anomaly.ipynb.
The trained model is exported to backend/models/audit_anomaly.pkl and
loaded automatically at server start.

Endpoints exposed here are read-only:
  GET  /api/anomaly/status   — model readiness, evaluation metrics, baseline
  GET  /api/anomaly/scores   — anomalous audit events above a threshold
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required

from backend.utils.rbac import get_current_organization_id
from backend.database.models import AnomalyScore
from backend.database.db import db

anomaly_bp = Blueprint('anomaly', __name__, url_prefix='/api/anomaly')


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


