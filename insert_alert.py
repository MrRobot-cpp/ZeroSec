from backend.app import app
from backend.database.db import db
from backend.database.models import AuditLog, Organization, CanaryToken
from datetime import datetime, timezone

with app.app_context():
    try:
        org = Organization.query.first()
        token = CanaryToken.query.first()
        
        log = AuditLog(
            organization_id=org.organization_id if org else 1,
            action='canary_token_triggered',
            target_type='CanaryToken',
            target_id=token.canary_token_id if token else 1,
            meta_data={
                'canary_id': 'bf6bbff1-9443-4f2b-a385-5e67528a8885',
                'reason': 'Insider Threat detected via forensic watermarking',
                'query': 'Exfiltration attempt detected for doc1.txt'
            },
            created_at=datetime.utcnow()
        )
        db.session.add(log)
        db.session.commit()
        print(f'SUCCESS: Inserted AuditLog ID {log.audit_id}')
    except Exception as e:
        print(f'ERROR: {str(e)}')
        db.session.rollback()
