"""
Audit logging utilities
Provides functions for logging all system actions
"""
from datetime import datetime, timezone
from backend.database.db import db
from backend.database.models import AuditLog

def log_audit(organization_id, user_id, action, target_type=None, target_id=None, metadata=None):
    """
    Log an audit event

    Args:
        organization_id: Organization ID
        user_id: User ID performing the action
        action: Action being performed (e.g., 'user_login', 'document_upload')
        target_type: Type of target entity (e.g., 'User', 'Document')
        target_id: ID of target entity
        metadata: Additional metadata as dictionary
    """
    try:
        audit_log = AuditLog(
            organization_id=organization_id,
            user_id=user_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            meta_data=metadata,
            created_at=datetime.now(timezone.utc)
        )
        db.session.add(audit_log)
        db.session.commit()
    except Exception as e:
        print(f"Error logging audit event: {e}")
        db.session.rollback()

def get_audit_logs(organization_id=None, user_id=None, action=None, target_type=None,
                   limit=100, offset=0):
    """
    Retrieve audit logs with filters

    Args:
        organization_id: Filter by organization
        user_id: Filter by user
        action: Filter by action type
        target_type: Filter by target type
        limit: Maximum number of records to return
        offset: Number of records to skip

    Returns:
        List of audit log dictionaries
    """
    query = AuditLog.query

    if organization_id:
        query = query.filter_by(organization_id=organization_id)
    if user_id:
        query = query.filter_by(user_id=user_id)
    if action:
        query = query.filter_by(action=action)
    if target_type:
        query = query.filter_by(target_type=target_type)

    logs = query.order_by(AuditLog.created_at.desc()).limit(limit).offset(offset).all()

    return [
        {
            'audit_id': log.audit_id,
            'organization_id': log.organization_id,
            'user_id': log.user_id,
            'username': log.user.username if log.user else None,
            'action': log.action,
            'target_type': log.target_type,
            'target_id': log.target_id,
            'metadata': log.meta_data,
            'created_at': log.created_at.isoformat()
        }
        for log in logs
    ]

def get_user_activity(user_id, limit=50):
    """Get recent activity for a specific user"""
    return get_audit_logs(user_id=user_id, limit=limit)

def get_document_activity(document_id, limit=50):
    """Get activity related to a specific document"""
    logs = AuditLog.query.filter_by(
        target_type='Document',
        target_id=document_id
    ).order_by(AuditLog.created_at.desc()).limit(limit).all()

    return [
        {
            'audit_id': log.audit_id,
            'user_id': log.user_id,
            'username': log.user.username if log.user else None,
            'action': log.action,
            'metadata': log.meta_data,
            'created_at': log.created_at.isoformat()
        }
        for log in logs
    ]
