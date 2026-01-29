"""
Authentication API endpoints
Handles user registration, login, logout, and token management
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token, create_refresh_token,
    jwt_required, get_jwt_identity, get_jwt
)
from datetime import datetime, timezone

from backend.database.db import db, bcrypt
from backend.database.models import User, Organization, Department, AuditLog, UserRole, Role, Subscription, Plan
from backend.utils.audit import log_audit

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

@auth_bp.route('/register', methods=['POST'])
def register():
    """Register a new user"""
    try:
        data = request.get_json()

        # Validate required fields
        required_fields = ['username', 'email', 'password', 'organization_name']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400

        # Check if user already exists
        if User.query.filter_by(username=data['username']).first():
            return jsonify({'error': 'Username already exists'}), 409

        if User.query.filter_by(email=data['email']).first():
            return jsonify({'error': 'Email already exists'}), 409

        # Get or create organization
        org = Organization.query.filter_by(name=data['organization_name']).first()
        is_new_org = False
        if not org:
            is_new_org = True
            org = Organization(
                name=data['organization_name'],
                created_at=datetime.now(timezone.utc)
            )
            db.session.add(org)
            db.session.flush()

            # Create default department for new organization
            default_dept = Department(
                organization_id=org.organization_id,
                name="General",
                created_at=datetime.now(timezone.utc)
            )
            db.session.add(default_dept)
            db.session.flush()

            # Create subscription if plan_id is provided
            plan_id = data.get('planId') or data.get('plan_id')
            if plan_id:
                # Verify plan exists
                plan = Plan.query.get(plan_id)
                if plan:
                    subscription = Subscription(
                        organization_id=org.organization_id,
                        plan_id=plan_id,
                        status='Active',
                        start_date=datetime.now(timezone.utc)
                    )
                    db.session.add(subscription)
                    db.session.flush()
            else:
                # Default to Free plan (plan_id = 1)
                free_plan = Plan.query.filter_by(name='Free').first()
                if free_plan:
                    subscription = Subscription(
                        organization_id=org.organization_id,
                        plan_id=free_plan.plan_id,
                        status='Active',
                        start_date=datetime.now(timezone.utc)
                    )
                    db.session.add(subscription)
                    db.session.flush()

        # Get default department
        dept = Department.query.filter_by(
            organization_id=org.organization_id
        ).first()

        # Hash password
        password_hash = bcrypt.generate_password_hash(data['password']).decode('utf-8')

        # Create user
        user = User(
            organization_id=org.organization_id,
            department_id=dept.department_id if dept else None,
            username=data['username'],
            email=data['email'],
            password_hash=password_hash,
            status='Active',
            created_at=datetime.utcnow()
        )
        db.session.add(user)
        db.session.flush()

        # Assign role based on whether this is the first user in the organization
        # First user gets "Security Admin" role, subsequent users get "User" role
        is_first_user = is_new_org or User.query.filter_by(organization_id=org.organization_id).count() == 1

        if is_first_user:
            # Assign "Security Admin" or "Super Admin" role to first user
            admin_role = Role.query.filter_by(
                organization_id=org.organization_id,
                name="Super Admin"
            ).first()

            # Fallback to Admin if Super Admin doesn't exist
            if not admin_role:
                admin_role = Role.query.filter_by(
                    organization_id=org.organization_id,
                    name="Admin"
                ).first()

            if admin_role:
                user_role = UserRole(
                    user_id=user.user_id,
                    role_id=admin_role.role_id
                )
                db.session.add(user_role)
        else:
            # Assign default "User" role to subsequent users
            default_role = Role.query.filter_by(
                organization_id=org.organization_id,
                name="User"
            ).first()

            if default_role:
                user_role = UserRole(
                    user_id=user.user_id,
                    role_id=default_role.role_id
                )
                db.session.add(user_role)

        db.session.commit()

        # Log audit event
        log_audit(
            organization_id=org.organization_id,
            user_id=user.user_id,
            action='user_registered',
            target_type='User',
            target_id=user.user_id,
            metadata={'username': user.username, 'email': user.email}
        )

        # Get subscription info if exists
        subscription_info = None
        subscription = Subscription.query.filter_by(
            organization_id=org.organization_id,
            status='Active'
        ).first()
        if subscription:
            subscription_info = {
                'plan_name': subscription.plan.name,
                'plan_id': subscription.plan.plan_id
            }

        return jsonify({
            'message': 'User registered successfully',
            'user': {
                'user_id': user.user_id,
                'username': user.username,
                'email': user.email,
                'organization': org.name,
                'is_first_user': is_first_user,
                'subscription': subscription_info
            }
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    """Login and get access token"""
    try:
        data = request.get_json()

        # Validate required fields
        if 'username' not in data or 'password' not in data:
            return jsonify({'error': 'Missing username or password'}), 400

        # Find user
        user = User.query.filter_by(username=data['username']).first()

        if not user:
            return jsonify({'error': 'Invalid username or password'}), 401

        # Check password
        if not bcrypt.check_password_hash(user.password_hash, data['password']):
            return jsonify({'error': 'Invalid username or password'}), 401

        # Check if user is active
        if user.status != 'Active':
            return jsonify({'error': 'User account is not active'}), 403

        # Get user roles and permissions
        roles = []
        permissions = set()
        for user_role in user.user_roles:
            roles.append(user_role.role.name)
            for perm in user_role.role.permissions:
                permissions.add(perm.permission)

        # Create access and refresh tokens
        additional_claims = {
            'organization_id': user.organization_id,
            'roles': roles,
            'permissions': list(permissions)
        }

        access_token = create_access_token(
            identity=str(user.user_id),
            additional_claims=additional_claims
        )
        refresh_token = create_refresh_token(
            identity=str(user.user_id),
            additional_claims=additional_claims
        )

        # Log audit event
        log_audit(
            organization_id=user.organization_id,
            user_id=user.user_id,
            action='user_login',
            target_type='User',
            target_id=user.user_id,
            metadata={'username': user.username}
        )

        return jsonify({
            'message': 'Login successful',
            'access_token': access_token,
            'refresh_token': refresh_token,
            'user': {
                'user_id': user.user_id,
                'username': user.username,
                'email': user.email,
                'organization_id': user.organization_id,
                'roles': roles,
                'permissions': list(permissions)
            }
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """Refresh access token"""
    try:
        current_user_id = get_jwt_identity()
        jwt_data = get_jwt()

        # Create new access token
        access_token = create_access_token(
            identity=str(current_user_id),
            additional_claims={
                'organization_id': jwt_data.get('organization_id'),
                'roles': jwt_data.get('roles', []),
                'permissions': jwt_data.get('permissions', [])
            }
        )

        return jsonify({
            'access_token': access_token
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    """Get current user information"""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)

        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Get user roles
        roles = [user_role.role.name for user_role in user.user_roles]

        # Get permissions
        permissions = set()
        for user_role in user.user_roles:
            for perm in user_role.role.permissions:
                permissions.add(perm.permission)

        return jsonify({
            'user': {
                'user_id': user.user_id,
                'username': user.username,
                'email': user.email,
                'organization_id': user.organization_id,
                'organization_name': user.organization.name,
                'department_id': user.department_id,
                'department_name': user.department.name if user.department else None,
                'clearance_level': user.clearance_level.name if user.clearance_level else None,
                'status': user.status,
                'roles': roles,
                'permissions': list(permissions),
                'created_at': user.created_at.isoformat()
            }
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    """Logout user"""
    try:
        current_user_id = get_jwt_identity()
        jwt_data = get_jwt()

        # Log audit event
        log_audit(
            organization_id=jwt_data.get('organization_id'),
            user_id=current_user_id,
            action='user_logout',
            target_type='User',
            target_id=current_user_id
        )

        return jsonify({'message': 'Logout successful'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/change-password', methods=['POST'])
@jwt_required()
def change_password():
    """Change user password"""
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()

        # Validate required fields
        if 'current_password' not in data or 'new_password' not in data:
            return jsonify({'error': 'Missing required fields'}), 400

        user = User.query.get(current_user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Check current password
        if not bcrypt.check_password_hash(user.password_hash, data['current_password']):
            return jsonify({'error': 'Invalid current password'}), 401

        # Update password
        user.password_hash = bcrypt.generate_password_hash(data['new_password']).decode('utf-8')
        db.session.commit()

        # Log audit event
        log_audit(
            organization_id=user.organization_id,
            user_id=user.user_id,
            action='password_changed',
            target_type='User',
            target_id=user.user_id
        )

        return jsonify({'message': 'Password changed successfully'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
