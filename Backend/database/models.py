"""
Database Models - Based on ERD
All tables and relationships for ZeroSec platform
"""
from datetime import datetime
from backend.database.db import db

class Organization(db.Model):
    """Organization/Company table"""
    __tablename__ = 'organisation'

    organization_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    departments = db.relationship('Department', backref='organization', lazy=True, cascade='all, delete-orphan')
    users = db.relationship('User', backref='organization', lazy=True, cascade='all, delete-orphan')
    documents = db.relationship('Document', backref='organization', lazy=True, cascade='all, delete-orphan')
    policies = db.relationship('Policy', backref='organization', lazy=True, cascade='all, delete-orphan')
    clearance_levels = db.relationship('ClearanceLevel', backref='organization', lazy=True, cascade='all, delete-orphan')
    roles = db.relationship('Role', backref='organization', lazy=True, cascade='all, delete-orphan')
    subscriptions = db.relationship('Subscription', backref='organization', lazy=True, cascade='all, delete-orphan')
    audit_logs = db.relationship('AuditLog', backref='organization', lazy=True, cascade='all, delete-orphan')

    def __repr__(self):
        return f'<Organization {self.name}>'

class Department(db.Model):
    """Departments within organizations"""
    __tablename__ = 'departments'

    department_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    organization_id = db.Column(db.Integer, db.ForeignKey('organisation.organization_id'), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    users = db.relationship('User', backref='department', lazy=True)

    def __repr__(self):
        return f'<Department {self.name}>'

class ClearanceLevel(db.Model):
    """Security clearance levels"""
    __tablename__ = 'clearance_levels'

    clearance_level_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    organization_id = db.Column(db.Integer, db.ForeignKey('organisation.organization_id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    level = db.Column(db.Integer, nullable=False)

    # Relationships
    users = db.relationship('User', backref='clearance_level', lazy=True)
    documents = db.relationship('Document', backref='clearance_level', lazy=True)

    def __repr__(self):
        return f'<Clearance_Level {self.name} (Level {self.level})>'

class User(db.Model):
    """Users table"""
    __tablename__ = 'users'

    user_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    organization_id = db.Column(db.Integer, db.ForeignKey('organisation.organization_id'), nullable=False)
    department_id = db.Column(db.Integer, db.ForeignKey('departments.department_id'), nullable=True)
    clearance_level_id = db.Column(db.Integer, db.ForeignKey('clearance_levels.clearance_level_id'), nullable=True)
    username = db.Column(db.String(100), unique=True, nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    status = db.Column(db.String(50), default='Active')
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    uploads = db.relationship('Upload', backref='user', lazy=True, cascade='all, delete-orphan')
    audit_logs = db.relationship('AuditLog', backref='user', lazy=True, cascade='all, delete-orphan')
    user_roles = db.relationship('UserRole', backref='user', lazy=True, cascade='all, delete-orphan')

    def __repr__(self):
        return f'<User {self.username}>'

    def has_permission(self, permission):
        """Check if user has a specific permission"""
        for user_role in self.user_roles:
            for role_perm in user_role.role.permissions:
                if role_perm.permission == permission:
                    return True
        return False

    def has_role(self, role_name):
        """Check if user has a specific role"""
        for user_role in self.user_roles:
            if user_role.role.name == role_name:
                return True
        return False

class Role(db.Model):
    """Roles for RBAC"""
    __tablename__ = 'roles'

    role_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    organization_id = db.Column(db.Integer, db.ForeignKey('organisation.organization_id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    permissions = db.relationship('RolePermission', backref='role', lazy=True, cascade='all, delete-orphan')
    user_roles = db.relationship('UserRole', backref='role', lazy=True, cascade='all, delete-orphan')

    def __repr__(self):
        return f'<Role {self.name}>'

class RolePermission(db.Model):
    """Permissions granted to roles"""
    __tablename__ = 'role_permissions'

    role_id = db.Column(db.Integer, db.ForeignKey('roles.role_id'), primary_key=True)
    permission = db.Column(db.String(100), primary_key=True)

    def __repr__(self):
        return f'<RolePermission {self.permission}>'

class UserRole(db.Model):
    """Many-to-many relationship between users and roles"""
    __tablename__ = 'user_roles'

    user_id = db.Column(db.Integer, db.ForeignKey('users.user_id'), primary_key=True)
    role_id = db.Column(db.Integer, db.ForeignKey('roles.role_id'), primary_key=True)

    def __repr__(self):
        return f'<UserRole user_id={self.user_id} role_id={self.role_id}>'

class Policy(db.Model):
    """RBAC/ABAC policies"""
    __tablename__ = 'policies'

    policy_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    organization_id = db.Column(db.Integer, db.ForeignKey('organisation.organization_id'), nullable=False)
    policy_type = db.Column(db.String(50), nullable=False)
    config = db.Column(db.JSON, nullable=True)
    enabled = db.Column(db.Boolean, default=True)

    def __repr__(self):
        return f'<Policy {self.policy_type}>'

class Document(db.Model):
    """Documents table"""
    __tablename__ = 'documents'

    document_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    organization_id = db.Column(db.Integer, db.ForeignKey('organisation.organization_id'), nullable=False)
    clearance_level_id = db.Column(db.Integer, db.ForeignKey('clearance_levels.clearance_level_id'), nullable=True)
    filename = db.Column(db.String(255), nullable=False)
    storage_ref = db.Column(db.String(500), nullable=False)
    sensitivity = db.Column(db.String(50), default='Medium')
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    uploads = db.relationship('Upload', backref='document', lazy=True, cascade='all, delete-orphan')
    canary_tokens = db.relationship('CanaryToken', backref='document', lazy=True, cascade='all, delete-orphan')

    def __repr__(self):
        return f'<Document {self.filename}>'

class Upload(db.Model):
    """File uploads tracking"""
    __tablename__ = 'uploads'

    upload_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    document_id = db.Column(db.Integer, db.ForeignKey('documents.document_id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.user_id'), nullable=False)
    uploaded_by = db.Column(db.String(100), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f'<Upload {self.upload_id}>'

class CanaryToken(db.Model):
    """Canary tokens for document tracking"""
    __tablename__ = 'canary_tokens'

    canary_token_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    document_id = db.Column(db.Integer, db.ForeignKey('documents.document_id'), nullable=False)
    organization_id = db.Column(db.Integer, db.ForeignKey('organisation.organization_id'), nullable=False)
    token_hash = db.Column(db.String(255), unique=True, nullable=False)
    is_triggered = db.Column(db.Boolean, default=False)
    triggered_at = db.Column(db.DateTime, nullable=True)

    def __repr__(self):
        return f'<Canary_Token {self.canary_token_id}>'

class Subscription(db.Model):
    """Organization subscriptions"""
    __tablename__ = 'subscriptions'

    subscription_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    organization_id = db.Column(db.Integer, db.ForeignKey('organisation.organization_id'), nullable=False)
    plan_id = db.Column(db.Integer, db.ForeignKey('plans.plan_id'), nullable=False)
    status = db.Column(db.String(50), default='Active')
    start_date = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    end_date = db.Column(db.DateTime, nullable=True)

    # Relationships
    usage_metrics = db.relationship('UsageMetric', backref='subscription', lazy=True, cascade='all, delete-orphan')

    def __repr__(self):
        return f'<Subscription {self.subscription_id}>'

class Plan(db.Model):
    """Subscription plans"""
    __tablename__ = 'plans'

    plan_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(100), nullable=False)
    features_page = db.Column(db.Text, nullable=True)
    limits = db.Column(db.JSON, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    subscriptions = db.relationship('Subscription', backref='plan', lazy=True)

    def __repr__(self):
        return f'<Plan {self.name}>'

class UsageMetric(db.Model):
    """Usage metrics tracking"""
    __tablename__ = 'usage_metrics'

    usage_metric_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    subscription_id = db.Column(db.Integer, db.ForeignKey('subscriptions.subscription_id'), nullable=False)
    metric_type = db.Column(db.String(100), nullable=False)
    metric_value = db.Column(db.Float, nullable=False)
    recorded_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f'<Usage_Metric {self.metric_type}>'

class AuditLog(db.Model):
    """Audit logs for tracking all actions"""
    __tablename__ = 'audit_logs'

    audit_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    organization_id = db.Column(db.Integer, db.ForeignKey('organisation.organization_id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.user_id'), nullable=True)
    action = db.Column(db.String(100), nullable=False)
    target_type = db.Column(db.String(100), nullable=True)
    target_id = db.Column(db.Integer, nullable=True)
    meta_data = db.Column(db.JSON, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f'<AuditLog {self.action} by user {self.user_id}>'
