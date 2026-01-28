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
