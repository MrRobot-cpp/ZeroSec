"""
Repository layer for database operations
Provides clean interface for data access
"""
from datetime import datetime, timezone
from backend.database.db import db
from backend.database.models import (
    Organization, Department, User, Role, RolePermission, UserRole,
    ClearanceLevel, Policy, Document, Upload, CanaryToken,
    Subscription, Plan, UsageMetric, AuditLog
)

class DocumentRepository:
    """Repository for Document operations"""

    @staticmethod
    def create_document(organization_id, filename, storage_ref, sensitivity='Medium',
                       clearance_level_id=None, user_id=None):
        """Create a new document"""
        document = Document(
            organization_id=organization_id,
            clearance_level_id=clearance_level_id,
            filename=filename,
            storage_ref=storage_ref,
            sensitivity=sensitivity,
            created_at=datetime.now(timezone.utc)
        )
        db.session.add(document)
        db.session.flush()

        # Create upload record if user_id provided
        if user_id:
            upload = Upload(
                document_id=document.document_id,
                user_id=user_id,
                created_at=datetime.now(timezone.utc)
            )
            db.session.add(upload)

        db.session.commit()
        return document

    @staticmethod
    def get_document_by_id(document_id):
        """Get document by ID"""
        return Document.query.get(document_id)

    @staticmethod
    def get_document_by_filename(organization_id, filename):
        """Get document by filename"""
        return Document.query.filter_by(
            organization_id=organization_id,
            filename=filename
        ).first()

    @staticmethod
    def get_all_documents(organization_id, limit=100, offset=0):
        """Get all documents for an organization"""
        return Document.query.filter_by(
            organization_id=organization_id
        ).order_by(Document.created_at.desc()).limit(limit).offset(offset).all()

    @staticmethod
    def delete_document(document_id):
        """Delete a document"""
        document = Document.query.get(document_id)
        if document:
            db.session.delete(document)
            db.session.commit()
            return True
        return False

    @staticmethod
    def update_document(document_id, **kwargs):
        """Update document fields"""
        document = Document.query.get(document_id)
        if document:
            for key, value in kwargs.items():
                if hasattr(document, key):
                    setattr(document, key, value)
            db.session.commit()
            return document
        return None

class UserRepository:
    """Repository for User operations"""

    @staticmethod
    def get_user_by_id(user_id):
        """Get user by ID"""
        return User.query.get(user_id)

    @staticmethod
    def get_user_by_username(username):
        """Get user by username"""
        return User.query.filter_by(username=username).first()

    @staticmethod
    def get_user_by_email(email):
        """Get user by email"""
        return User.query.filter_by(email=email).first()

    @staticmethod
    def get_users_by_organization(organization_id, limit=100, offset=0):
        """Get all users in an organization"""
        return User.query.filter_by(
            organization_id=organization_id
        ).limit(limit).offset(offset).all()

    @staticmethod
    def create_user(organization_id, username, email, password_hash, department_id=None, clearance_level_id=None, status="Active"):
        """Create a new user"""
        from backend.database.db import db
        user = User(
            organization_id=organization_id,
            username=username,
            email=email,
            password_hash=password_hash,
            department_id=department_id,
            clearance_level_id=clearance_level_id,
            status=status
        )
        db.session.add(user)
        db.session.commit()
        return user

    @staticmethod
    def update_user(user_id, **kwargs):
        """Update user fields"""
        user = User.query.get(user_id)
        if user:
            for key, value in kwargs.items():
                if hasattr(user, key):
                    setattr(user, key, value)
            db.session.commit()
            return user
        return None

    @staticmethod
    def delete_user(user_id):
        """Delete a user"""
        user = User.query.get(user_id)
        if user:
            db.session.delete(user)
            db.session.commit()
            return True
        return False

class RoleRepository:
    """Repository for Role operations"""

    @staticmethod
    def get_role_by_id(role_id):
        """Get role by ID"""
        return Role.query.get(role_id)

    @staticmethod
    def get_role_by_name(organization_id, name):
        """Get role by name"""
        return Role.query.filter_by(
            organization_id=organization_id,
            name=name
        ).first()

    @staticmethod
    def get_roles_by_organization(organization_id):
        """Get all roles in an organization"""
        return Role.query.filter_by(organization_id=organization_id).all()

    @staticmethod
    def create_role(organization_id, name, description=None, permissions=None):
        """Create a new role"""
        role = Role(
            organization_id=organization_id,
            name=name,
            description=description,
            created_at=datetime.now(timezone.utc)
        )
        db.session.add(role)
        db.session.flush()

        # Add permissions
        if permissions:
            for permission in permissions:
                role_perm = RolePermission(
                    role_id=role.role_id,
                    permission=permission
                )
                db.session.add(role_perm)

        db.session.commit()
        return role

    @staticmethod
    def assign_role_to_user(user_id, role_id):
        """Assign a role to a user"""
        # Check if already assigned
        existing = UserRole.query.filter_by(
            user_id=user_id,
            role_id=role_id
        ).first()

        if existing:
            return existing

        user_role = UserRole(
            user_id=user_id,
            role_id=role_id
        )
        db.session.add(user_role)
        db.session.commit()
        return user_role

    @staticmethod
    def remove_role_from_user(user_id, role_id):
        """Remove a role from a user"""
        user_role = UserRole.query.filter_by(
            user_id=user_id,
            role_id=role_id
        ).first()

        if user_role:
            db.session.delete(user_role)
            db.session.commit()
            return True
        return False

    @staticmethod
    def update_role(role_id, name=None, description=None, permissions=None):
        """Update an existing role"""
        role = Role.query.get(role_id)
        if not role:
            return None

        if name is not None:
            role.name = name
        if description is not None:
            role.description = description

        # Update permissions if provided
        if permissions is not None:
            # Delete existing permissions
            RolePermission.query.filter_by(role_id=role_id).delete()

            # Add new permissions
            for permission in permissions:
                role_perm = RolePermission(
                    role_id=role_id,
                    permission=permission
                )
                db.session.add(role_perm)

        db.session.commit()
        return role

    @staticmethod
    def delete_role(role_id):
        """Delete a role"""
        role = Role.query.get(role_id)
        if role:
            # Delete associated permissions
            RolePermission.query.filter_by(role_id=role_id).delete()
            # Delete associated user roles
            UserRole.query.filter_by(role_id=role_id).delete()
            # Delete the role
            db.session.delete(role)
            db.session.commit()
            return True
        return False

    @staticmethod
    def get_role_permissions(role_id):
        """Get all permissions for a role"""
        permissions = RolePermission.query.filter_by(role_id=role_id).all()
        return [perm.permission for perm in permissions]

    @staticmethod
    def get_users_with_role(role_id):
        """Get all users with a specific role"""
        user_roles = UserRole.query.filter_by(role_id=role_id).all()
        return [ur.user_id for ur in user_roles]

class CanaryTokenRepository:
    """Repository for Canary Token operations"""

    @staticmethod
    def create_canary_token(document_id, organization_id, token_hash):
        """Create a new canary token"""
        canary = CanaryToken(
            document_id=document_id,
            organization_id=organization_id,
            token_hash=token_hash,
            is_triggered=False
        )
        db.session.add(canary)
        db.session.commit()
        return canary

    @staticmethod
    def get_canary_token_by_hash(token_hash):
        """Get canary token by hash"""
        return CanaryToken.query.filter_by(token_hash=token_hash).first()

    @staticmethod
    def trigger_canary_token(token_hash):
        """Mark canary token as triggered"""
        canary = CanaryToken.query.filter_by(token_hash=token_hash).first()
        if canary:
            canary.is_triggered = True
            canary.triggered_at = datetime.now(timezone.utc)
            db.session.commit()
            return canary
        return None

    @staticmethod
    def get_triggered_tokens(organization_id):
        """Get all triggered canary tokens"""
        return CanaryToken.query.filter_by(
            organization_id=organization_id,
            is_triggered=True
        ).order_by(CanaryToken.triggered_at.desc()).all()

class OrganizationRepository:
    """Repository for Organization operations"""

    @staticmethod
    def get_organization_by_id(organization_id):
        """Get organization by ID"""
        return Organization.query.get(organization_id)

    @staticmethod
    def get_organization_by_name(name):
        """Get organization by name"""
        return Organization.query.filter_by(name=name).first()

    @staticmethod
    def create_organization(name):
        """Create a new organization"""
        org = Organization(
            name=name,
            created_at=datetime.now(timezone.utc)
        )
        db.session.add(org)
        db.session.commit()
        return org

class SubscriptionRepository:
    """Repository for Subscription operations"""

    @staticmethod
    def get_active_subscription(organization_id):
        """Get active subscription for organization"""
        return Subscription.query.filter_by(
            organization_id=organization_id,
            status='Active'
        ).first()

    @staticmethod
    def create_subscription(organization_id, plan_id):
        """Create a new subscription"""
        subscription = Subscription(
            organization_id=organization_id,
            plan_id=plan_id,
            status='Active',
            start_date=datetime.now(timezone.utc)
        )
        db.session.add(subscription)
        db.session.commit()
        return subscription

    @staticmethod
    def get_plan_by_name(name):
        """Get plan by name"""
        return Plan.query.filter_by(name=name).first()

    @staticmethod
    def record_usage_metric(subscription_id, metric_type, metric_value):
        """Record a usage metric"""
        metric = UsageMetric(
            subscription_id=subscription_id,
            metric_type=metric_type,
            metric_value=metric_value,
            recorded_at=datetime.now(timezone.utc)
        )
        db.session.add(metric)
        db.session.commit()
        return metric

class DashboardRepository:
    """Repository for Dashboard metrics and statistics"""

    @staticmethod
    def get_document_stats(organization_id):
        """Get document statistics"""
        from sqlalchemy import func

        total_documents = Document.query.filter_by(organization_id=organization_id).count()

        # Documents uploaded in last 24 hours
        from datetime import timedelta
        yesterday = datetime.now(timezone.utc) - timedelta(days=1)
        recent_uploads = Document.query.filter(
            Document.organization_id == organization_id,
            Document.created_at >= yesterday
        ).count()

        # Documents by sensitivity level
        sensitivity_distribution = db.session.query(
            Document.sensitivity,
            func.count(Document.document_id)
        ).filter_by(organization_id=organization_id).group_by(Document.sensitivity).all()

        return {
            'total_documents': total_documents,
            'recent_uploads': recent_uploads,
            'sensitivity_distribution': dict(sensitivity_distribution)
        }

    @staticmethod
    def get_security_stats(organization_id):
        """Get security-related statistics"""
        # Count triggered canary tokens
        triggered_canaries = CanaryToken.query.filter_by(
            organization_id=organization_id,
            is_triggered=True
        ).count()

        # Count total canary tokens
        total_canaries = CanaryToken.query.filter_by(organization_id=organization_id).count()

        # Count security-related audit events in last 24 hours
        from datetime import timedelta
        yesterday = datetime.now(timezone.utc) - timedelta(days=1)

        security_events = AuditLog.query.filter(
            AuditLog.organization_id == organization_id,
            AuditLog.created_at >= yesterday,
            AuditLog.action.in_([
                'canary_token_triggered',
                'document_deleted',
                'unauthorized_access',
                'policy_violation'
            ])
        ).count()

        return {
            'triggered_canaries': triggered_canaries,
            'total_canaries': total_canaries,
            'recent_security_events': security_events,
            'canary_trigger_rate': (triggered_canaries / total_canaries * 100) if total_canaries > 0 else 0
        }

    @staticmethod
    def get_user_activity_stats(organization_id):
        """Get user activity statistics"""
        from sqlalchemy import func
        from datetime import timedelta

        # Total users
        total_users = User.query.filter_by(organization_id=organization_id).count()

        # Active users in last 24 hours (based on audit logs)
        yesterday = datetime.now(timezone.utc) - timedelta(days=1)
        active_users = db.session.query(func.count(func.distinct(AuditLog.user_id))).filter(
            AuditLog.organization_id == organization_id,
            AuditLog.created_at >= yesterday
        ).scalar()

        # Top actions in last 24 hours
        top_actions = db.session.query(
            AuditLog.action,
            func.count(AuditLog.audit_id)
        ).filter(
            AuditLog.organization_id == organization_id,
            AuditLog.created_at >= yesterday
        ).group_by(AuditLog.action).order_by(func.count(AuditLog.audit_id).desc()).limit(5).all()

        return {
            'total_users': total_users,
            'active_users_24h': active_users,
            'top_actions': [{'action': action, 'count': count} for action, count in top_actions]
        }

    @staticmethod
    def get_audit_summary(organization_id, days=7):
        """Get audit log summary for specified number of days"""
        from sqlalchemy import func
        from datetime import timedelta

        start_date = datetime.now(timezone.utc) - timedelta(days=days)

        # Total audit events
        total_events = AuditLog.query.filter(
            AuditLog.organization_id == organization_id,
            AuditLog.created_at >= start_date
        ).count()

        # Events by day
        events_by_day = db.session.query(
            func.date(AuditLog.created_at).label('date'),
            func.count(AuditLog.audit_id).label('count')
        ).filter(
            AuditLog.organization_id == organization_id,
            AuditLog.created_at >= start_date
        ).group_by(func.date(AuditLog.created_at)).all()

        # Events by type
        events_by_type = db.session.query(
            AuditLog.action,
            func.count(AuditLog.audit_id)
        ).filter(
            AuditLog.organization_id == organization_id,
            AuditLog.created_at >= start_date
        ).group_by(AuditLog.action).all()

        return {
            'total_events': total_events,
            'events_by_day': [{'date': str(date), 'count': count} for date, count in events_by_day],
            'events_by_type': [{'action': action, 'count': count} for action, count in events_by_type]
        }

    @staticmethod
    def get_policy_stats(organization_id):
        """Get policy statistics"""
        total_policies = Policy.query.filter_by(organization_id=organization_id).count()
        enabled_policies = Policy.query.filter_by(organization_id=organization_id, enabled=True).count()

        # Policies by type
        from sqlalchemy import func
        policies_by_type = db.session.query(
            Policy.policy_type,
            func.count(Policy.policy_id)
        ).filter_by(organization_id=organization_id).group_by(Policy.policy_type).all()

        return {
            'total_policies': total_policies,
            'enabled_policies': enabled_policies,
            'policies_by_type': dict(policies_by_type)
        }

    @staticmethod
    def get_system_health(organization_id):
        """Get system health indicators"""
        from datetime import timedelta

        # Check for recent activity (last hour)
        last_hour = datetime.now(timezone.utc) - timedelta(hours=1)
        recent_activity = AuditLog.query.filter(
            AuditLog.organization_id == organization_id,
            AuditLog.created_at >= last_hour
        ).count()

        # Check for errors or failures
        last_24h = datetime.now(timezone.utc) - timedelta(days=1)
        error_count = AuditLog.query.filter(
            AuditLog.organization_id == organization_id,
            AuditLog.created_at >= last_24h,
            AuditLog.action.like('%error%')
        ).count()

        # Determine health status
        if recent_activity > 0 and error_count == 0:
            status = 'healthy'
        elif recent_activity > 0 and error_count < 10:
            status = 'warning'
        else:
            status = 'critical'

        return {
            'status': status,
            'recent_activity': recent_activity,
            'error_count_24h': error_count,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }

    @staticmethod
    def get_alerts(organization_id, status='all', limit=50):
        """Get security alerts (security-related audit log events)"""
        from datetime import timedelta

        # Security-related actions that should trigger alerts
        security_actions = [
            'canary_token_triggered',
            'unauthorized_access',
            'policy_violation',
            'document_deleted',
            'user_suspended',
            'password_changed',
            'login_failed',
            'access_denied'
        ]

        # Query security-related audit logs
        query = AuditLog.query.filter(
            AuditLog.organization_id == organization_id,
            AuditLog.action.in_(security_actions)
        )

        # Filter by status if provided
        if status == 'open':
            # Open alerts are recent (last 24 hours)
            last_24h = datetime.now(timezone.utc) - timedelta(days=1)
            query = query.filter(AuditLog.created_at >= last_24h)
        elif status == 'closed':
            # Closed alerts are older (more than 24 hours)
            last_24h = datetime.now(timezone.utc) - timedelta(days=1)
            query = query.filter(AuditLog.created_at < last_24h)

        alerts = query.order_by(AuditLog.created_at.desc()).limit(limit).all()

        # Convert to alert format
        alert_list = []
        for alert in alerts:
            alert_dict = {
                'id': alert.audit_id,
                'type': alert.action,
                'message': f"{alert.action.replace('_', ' ').title()}",
                'severity': 'high' if alert.action == 'unauthorized_access' else 'medium',
                'timestamp': alert.created_at.isoformat(),
                'status': 'open' if (datetime.now(timezone.utc) - alert.created_at).days < 1 else 'closed',
                'user': alert.user.username if alert.user else 'System',
                'target': alert.target_type,
                'target_id': alert.target_id
            }
            alert_list.append(alert_dict)

        return alert_list

class PolicyRepository:
    """Repository for Policy operations"""

    @staticmethod
    def get_all_policies(organization_id):
        """Get all policies for an organization"""
        return Policy.query.filter_by(organization_id=organization_id).all()

    @staticmethod
    def get_policy_by_id(policy_id):
        """Get policy by ID"""
        return Policy.query.get(policy_id)

    @staticmethod
    def get_policies_by_type(organization_id, policy_type):
        """Get policies by type for an organization"""
        return Policy.query.filter_by(
            organization_id=organization_id,
            policy_type=policy_type
        ).all()

    @staticmethod
    def get_enabled_policies(organization_id):
        """Get all enabled policies for an organization"""
        return Policy.query.filter_by(
            organization_id=organization_id,
            enabled=True
        ).all()

    @staticmethod
    def create_policy(organization_id, policy_type, config, enabled=True):
        """Create a new policy"""
        policy = Policy(
            organization_id=organization_id,
            policy_type=policy_type,
            config=config,
            enabled=enabled
        )
        db.session.add(policy)
        db.session.commit()
        return policy

    @staticmethod
    def update_policy(policy_id, policy_type=None, config=None, enabled=None):
        """Update an existing policy"""
        policy = Policy.query.get(policy_id)
        if not policy:
            return None

        if policy_type is not None:
            policy.policy_type = policy_type
        if config is not None:
            policy.config = config
        if enabled is not None:
            policy.enabled = enabled

        db.session.commit()
        return policy

    @staticmethod
    def delete_policy(policy_id):
        """Delete a policy"""
        policy = Policy.query.get(policy_id)
        if policy:
            db.session.delete(policy)
            db.session.commit()
            return True
        return False

    @staticmethod
    def toggle_policy(policy_id):
        """Toggle policy enabled status"""
        policy = Policy.query.get(policy_id)
        if policy:
            policy.enabled = not policy.enabled
            db.session.commit()
            return policy
        return None
