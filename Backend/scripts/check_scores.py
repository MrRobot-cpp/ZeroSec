
from backend.app import app
from backend.database.models import AnomalyScore, AuditLog
from backend.database.db import db

with app.app_context():
    # Check latest audit logs regardless of org
    logs = AuditLog.query.order_by(AuditLog.created_at.desc()).limit(20).all()
    print(f"Latest {len(logs)} Audit Logs:")
    for l in logs:
        score = AnomalyScore.query.filter_by(audit_id=l.audit_id).first()
        score_val = score.anomaly_score if score else "NONE"
        print(f"ID: {l.audit_id} | OrgID: {l.organization_id} | Action: {l.action} | Created: {l.created_at} | Score: {score_val}")

    # Check for any errors in the table
    print("\nRecent Anomaly Scores:")
    scores = AnomalyScore.query.order_by(AnomalyScore.score_id.desc()).limit(10).all()
    for s in scores:
        print(f"AuditID: {s.audit_id} | Score: {s.anomaly_score} | Type: {s.anomaly_type}")
