
from backend.app import app
from backend.database.models import AnomalyScore, AuditLog
from backend.database.db import db
from datetime import datetime, timedelta

with app.app_context():
    # Final search for ANY logs or scores in the last 20 minutes
    print(f"Current Time: {datetime.utcnow()}")
    since = datetime.utcnow() - timedelta(minutes=20)
    
    logs = AuditLog.query.filter(AuditLog.created_at >= since).all()
    print(f"Audit Logs in last 20min: {len(logs)}")
    for l in logs:
        print(f"  ID: {l.audit_id} | Action: {l.action} | Created: {l.created_at}")

    scores = AnomalyScore.query.filter(AnomalyScore.scored_at >= since).all()
    print(f"Anomaly Scores in last 20min: {len(scores)}")
    for s in scores:
        print(f"  AuditID: {s.audit_id} | Score: {s.anomaly_score} | Type: {s.anomaly_type}")
