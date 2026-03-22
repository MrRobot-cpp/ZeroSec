"""
User Management API
Handles CRUD operations for users
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from backend.database.repository import UserRepository, RoleRepository
from backend.database.db import db, bcrypt
from backend.utils.rbac import require_permission, get_current_organization_id
from backend.utils.audit import log_audit

users_bp = Blueprint('users', __name__, url_prefix='/api')


@users_bp.route('/users', methods=['GET'])
@jwt_required()
def get_users():
    """Get all users in the organization"""
    try:
        organization_id = get_current_organization_id()
        users = UserRepository.get_users_by_organization(organization_id)

        users_data = []
        for user in users:
            # Get first role assigned to user (RBAC)
            user_role = user.user_roles[0].role if user.user_roles else None
            user_data = {
                'user_id': user.user_id,
                'username': user.username,
                'email': user.email,
                'status': user.status,
                'role': user_role.name if user_role else None,
                'department': user.department.name if user.department else None,
                'clearanceLevel': user.clearance_level.name if user.clearance_level else None,
                'created_at': user.created_at.isoformat() if user.created_at else None
            }
            users_data.append(user_data)

        return jsonify({'users': users_data}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@users_bp.route('/users/<int:user_id>', methods=['GET'])
@jwt_required()
def get_user(user_id):
    """Get a specific user by ID"""
    try:
        organization_id = get_current_organization_id()
        user = UserRepository.get_user_by_id(user_id)

        if not user or user.organization_id != organization_id:
            return jsonify({'error': 'User not found'}), 404

        # Get user role (RBAC)
        user_role = user.user_roles[0].role if user.user_roles else None

        user_data = {
            'user_id': user.user_id,
            'username': user.username,
            'email': user.email,
            'status': user.status,
            'role': user_role.name if user_role else None,
            'department': user.department.name if user.department else None,
            'clearanceLevel': user.clearance_level.name if user.clearance_level else None,
            'created_at': user.created_at.isoformat() if user.created_at else None
        }

        return jsonify({'user': user_data}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@users_bp.route('/users', methods=['POST'])
@jwt_required()
@require_permission('create')
def create_user():
    """Create a new user"""
    try:
        organization_id = get_current_organization_id()
        user_id = get_jwt_identity()

        data = request.get_json()

        # Validate required fields
        if not data.get('username') or not data.get('password') or not data.get('email'):
            return jsonify({'error': 'Username, email, and password are required'}), 400

        # Check if user already exists
        if UserRepository.get_user_by_username(data.get('username')):
            return jsonify({'error': 'Username already exists'}), 400

        if UserRepository.get_user_by_email(data.get('email')):
            return jsonify({'error': 'Email already exists'}), 400

        # Hash password
        password_hash = bcrypt.generate_password_hash(data.get('password')).decode('utf-8')

        # Resolve department ID (handle both ID and name)
        department_id = data.get('department_id')
        if not department_id and data.get('department'):
            from backend.database.models import Department
            dept = Department.query.filter_by(
                organization_id=organization_id,
                name=data.get('department')
            ).first()
            if dept:
                department_id = dept.department_id

        # Resolve clearance level ID (handle both ID and name)
        clearance_level_id = data.get('clearance_level_id')
        if not clearance_level_id and data.get('clearanceLevel'):
            from backend.database.models import ClearanceLevel
            clearance = ClearanceLevel.query.filter_by(
                organization_id=organization_id,
                name=data.get('clearanceLevel')
            ).first()
            if clearance:
                clearance_level_id = clearance.clearance_level_id

        # Create user
        new_user = UserRepository.create_user(
            organization_id=organization_id,
            username=data.get('username'),
            email=data.get('email'),
            password_hash=password_hash,
            department_id=department_id,
            clearance_level_id=clearance_level_id,
            status=data.get('status', 'Active')
        )

        # Assign role to user (RBAC)
        role_name = data.get('role')
        if role_name:
            from backend.database.models import Role
            role = Role.query.filter_by(
                organization_id=organization_id,
                name=role_name
            ).first()

            if role:
                RoleRepository.assign_role_to_user(new_user.user_id, role.role_id)

        # Refresh user object to get updated relationships
        db.session.expire(new_user)
        new_user = UserRepository.get_user_by_id(new_user.user_id)

        # Log audit event
        log_audit(
            organization_id=organization_id,
            user_id=user_id,
            action='user_created',
            target_type='User',
            target_id=new_user.user_id,
            metadata={'username': new_user.username}
        )

        # Get user with all relationships
        user_role = new_user.user_roles[0].role if new_user.user_roles else None
        user_data = {
            'user_id': new_user.user_id,
            'username': new_user.username,
            'email': new_user.email,
            'status': new_user.status,
            'role': user_role.name if user_role else None,
            'department': new_user.department.name if new_user.department else None,
            'clearanceLevel': new_user.clearance_level.name if new_user.clearance_level else None,
            'created_at': new_user.created_at.isoformat() if new_user.created_at else None
        }

        return jsonify({'user': user_data}), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@users_bp.route('/users/<int:user_id>', methods=['PUT'])
@jwt_required()
@require_permission('update')
def update_user(user_id):
    """Update a user"""
    try:
        organization_id = get_current_organization_id()
        current_user_id = get_jwt_identity()

        user = UserRepository.get_user_by_id(user_id)

        if not user or user.organization_id != organization_id:
            return jsonify({'error': 'User not found'}), 404

        data = request.get_json()

        # Resolve department ID (handle both ID and name)
        if data.get('department') and 'department_id' not in data:
            from backend.database.models import Department
            dept = Department.query.filter_by(
                organization_id=organization_id,
                name=data.get('department')
            ).first()
            if dept:
                data['department_id'] = dept.department_id

        # Resolve clearance level ID (handle both ID and name)
        if data.get('clearanceLevel') and 'clearance_level_id' not in data:
            from backend.database.models import ClearanceLevel
            clearance = ClearanceLevel.query.filter_by(
                organization_id=organization_id,
                name=data.get('clearanceLevel')
            ).first()
            if clearance:
                data['clearance_level_id'] = clearance.clearance_level_id

        # Update allowed fields
        updateable_fields = ['email', 'status', 'department_id', 'clearance_level_id']

        for field in updateable_fields:
            if field in data:
                setattr(user, field, data[field])

        # Handle role update (RBAC)
        if 'role' in data:
            role_name = data.get('role')
            # Clear existing roles
            user.user_roles.clear()
            # Assign new role if provided
            if role_name:
                from backend.database.models import Role
                role = Role.query.filter_by(
                    organization_id=organization_id,
                    name=role_name
                ).first()
                if role:
                    RoleRepository.assign_role_to_user(user.user_id, role.role_id)

        db.session.commit()

        # Log audit event
        log_audit(
            organization_id=organization_id,
            user_id=current_user_id,
            action='user_updated',
            target_type='User',
            target_id=user_id,
            metadata={'username': user.username}
        )

        # Get user role (RBAC)
        user_role = user.user_roles[0].role if user.user_roles else None

        user_data = {
            'user_id': user.user_id,
            'username': user.username,
            'email': user.email,
            'status': user.status,
            'role': user_role.name if user_role else None,
            'department': user.department.name if user.department else None,
            'clearanceLevel': user.clearance_level.name if user.clearance_level else None,
            'created_at': user.created_at.isoformat() if user.created_at else None
        }

        return jsonify({'user': user_data}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@users_bp.route('/users/<int:user_id>', methods=['DELETE'])
@jwt_required()
@require_permission('delete')
def delete_user(user_id):
    """Delete a user"""
    try:
        organization_id = get_current_organization_id()
        current_user_id = get_jwt_identity()

        user = UserRepository.get_user_by_id(user_id)

        if not user or user.organization_id != organization_id:
            return jsonify({'error': 'User not found'}), 404

        username = user.username
        UserRepository.delete_user(user_id)

        # Log audit event
        log_audit(
            organization_id=organization_id,
            user_id=current_user_id,
            action='user_deleted',
            target_type='User',
            target_id=user_id,
            metadata={'username': username}
        )

        return jsonify({'message': 'User deleted successfully'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@users_bp.route('/users/<int:user_id>/suspend', methods=['POST'])
@jwt_required()
@require_permission('update')
def suspend_user(user_id):
    """Suspend a user account"""
    try:
        organization_id = get_current_organization_id()
        current_user_id = get_jwt_identity()

        user = UserRepository.get_user_by_id(user_id)

        if not user or user.organization_id != organization_id:
            return jsonify({'error': 'User not found'}), 404

        UserRepository.update_user(user_id, status='Suspended')

        # Log audit event
        log_audit(
            organization_id=organization_id,
            user_id=current_user_id,
            action='user_suspended',
            target_type='User',
            target_id=user_id,
            metadata={'username': user.username}
        )

        user_data = {
            'user_id': user.user_id,
            'username': user.username,
            'email': user.email,
            'status': 'Suspended',
            'created_at': user.created_at.isoformat() if user.created_at else None
        }

        return jsonify({'user': user_data}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@users_bp.route('/users/<int:user_id>/activate', methods=['POST'])
@jwt_required()
@require_permission('update')
def activate_user(user_id):
    """Activate a user account"""
    try:
        organization_id = get_current_organization_id()
        current_user_id = get_jwt_identity()

        user = UserRepository.get_user_by_id(user_id)

        if not user or user.organization_id != organization_id:
            return jsonify({'error': 'User not found'}), 404

        UserRepository.update_user(user_id, status='Active')

        # Log audit event
        log_audit(
            organization_id=organization_id,
            user_id=current_user_id,
            action='user_activated',
            target_type='User',
            target_id=user_id,
            metadata={'username': user.username}
        )

        user_data = {
            'user_id': user.user_id,
            'username': user.username,
            'email': user.email,
            'status': 'Active',
            'created_at': user.created_at.isoformat() if user.created_at else None
        }

        return jsonify({'user': user_data}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
