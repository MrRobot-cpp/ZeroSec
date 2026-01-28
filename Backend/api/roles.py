"""
RBAC Role Management API
Handles role and permission CRUD operations
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from backend.database.repository import RoleRepository, UserRepository
from backend.utils.audit import log_audit
from backend.utils.rbac import require_permission

roles_bp = Blueprint("roles_bp", __name__)


@roles_bp.route('/api/roles', methods=['GET'])
@jwt_required()
def get_roles():
    """Get all roles for the user's organization"""
    current_user = get_jwt_identity()
    organization_id = current_user.get('organization_id')

    try:
        roles = RoleRepository.get_roles_by_organization(organization_id)

        roles_data = [{
            'role_id': role.role_id,
            'name': role.name,
            'description': role.description,
            'created_at': role.created_at.isoformat() if role.created_at else None,
            'permissions': RoleRepository.get_role_permissions(role.role_id),
            'user_count': len(RoleRepository.get_users_with_role(role.role_id))
        } for role in roles]

        return jsonify({'roles': roles_data}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@roles_bp.route('/api/roles/<int:role_id>', methods=['GET'])
@jwt_required()
def get_role(role_id):
    """Get a specific role by ID"""
    current_user = get_jwt_identity()
    organization_id = current_user.get('organization_id')

    try:
        role = RoleRepository.get_role_by_id(role_id)

        if not role:
            return jsonify({'error': 'Role not found'}), 404

        # Verify role belongs to user's organization
        if role.organization_id != organization_id:
            return jsonify({'error': 'Unauthorized'}), 403

        role_data = {
            'role_id': role.role_id,
            'name': role.name,
            'description': role.description,
            'created_at': role.created_at.isoformat() if role.created_at else None,
            'permissions': RoleRepository.get_role_permissions(role.role_id),
            'users': RoleRepository.get_users_with_role(role.role_id)
        }

        return jsonify(role_data), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@roles_bp.route('/api/roles', methods=['POST'])
@jwt_required()
@require_permission('role_manage')
def create_role():
    """Create a new role"""
    current_user = get_jwt_identity()
    organization_id = current_user.get('organization_id')
    user_id = current_user.get('user_id')

    try:
        data = request.get_json()

        if not data:
            return jsonify({'error': 'Missing request body'}), 400

        name = data.get('name')
        description = data.get('description', '')
        permissions = data.get('permissions', [])

        if not name:
            return jsonify({'error': 'Missing role name'}), 400

        # Check if role name already exists
        existing_role = RoleRepository.get_role_by_name(organization_id, name)
        if existing_role:
            return jsonify({'error': f'Role "{name}" already exists'}), 409

        # Create role
        role = RoleRepository.create_role(
            organization_id=organization_id,
            name=name,
            description=description,
            permissions=permissions
        )

        # Log audit
        log_audit(
            organization_id=organization_id,
            user_id=user_id,
            action='role_created',
            target_type='Role',
            target_id=role.role_id,
            meta_data={
                'role_name': name,
                'permissions': permissions
            }
        )

        role_data = {
            'role_id': role.role_id,
            'name': role.name,
            'description': role.description,
            'created_at': role.created_at.isoformat() if role.created_at else None,
            'permissions': RoleRepository.get_role_permissions(role.role_id)
        }

        return jsonify({
            'message': 'Role created successfully',
            'role': role_data
        }), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@roles_bp.route('/api/roles/<int:role_id>', methods=['PUT'])
@jwt_required()
@require_permission('role_manage')
def update_role(role_id):
    """Update an existing role"""
    current_user = get_jwt_identity()
    organization_id = current_user.get('organization_id')
    user_id = current_user.get('user_id')

    try:
        # Verify role exists and belongs to organization
        role = RoleRepository.get_role_by_id(role_id)
        if not role:
            return jsonify({'error': 'Role not found'}), 404

        if role.organization_id != organization_id:
            return jsonify({'error': 'Unauthorized'}), 403

        data = request.get_json()
        if not data:
            return jsonify({'error': 'Missing request body'}), 400

        name = data.get('name')
        description = data.get('description')
        permissions = data.get('permissions')

        # Check if new name conflicts with existing role
        if name and name != role.name:
            existing_role = RoleRepository.get_role_by_name(organization_id, name)
            if existing_role:
                return jsonify({'error': f'Role "{name}" already exists'}), 409

        # Update role
        updated_role = RoleRepository.update_role(
            role_id=role_id,
            name=name,
            description=description,
            permissions=permissions
        )

        # Log audit
        log_audit(
            organization_id=organization_id,
            user_id=user_id,
            action='role_updated',
            target_type='Role',
            target_id=role_id,
            meta_data={
                'role_name': updated_role.name,
                'permissions': RoleRepository.get_role_permissions(role_id)
            }
        )

        role_data = {
            'role_id': updated_role.role_id,
            'name': updated_role.name,
            'description': updated_role.description,
            'created_at': updated_role.created_at.isoformat() if updated_role.created_at else None,
            'permissions': RoleRepository.get_role_permissions(role_id)
        }

        return jsonify({
            'message': 'Role updated successfully',
            'role': role_data
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@roles_bp.route('/api/roles/<int:role_id>', methods=['DELETE'])
@jwt_required()
@require_permission('role_manage')
def delete_role(role_id):
    """Delete a role"""
    current_user = get_jwt_identity()
    organization_id = current_user.get('organization_id')
    user_id = current_user.get('user_id')

    try:
        # Verify role exists and belongs to organization
        role = RoleRepository.get_role_by_id(role_id)
        if not role:
            return jsonify({'error': 'Role not found'}), 404

        if role.organization_id != organization_id:
            return jsonify({'error': 'Unauthorized'}), 403

        # Prevent deletion of default roles
        if role.name in ['Admin', 'User', 'SecurityAdmin']:
            return jsonify({'error': 'Cannot delete default roles'}), 403

        # Check if users are assigned to this role
        users_with_role = RoleRepository.get_users_with_role(role_id)
        if users_with_role:
            return jsonify({
                'error': f'Cannot delete role. {len(users_with_role)} user(s) are assigned to this role. Please reassign users first.'
            }), 409

        # Delete role
        success = RoleRepository.delete_role(role_id)

        if success:
            # Log audit
            log_audit(
                organization_id=organization_id,
                user_id=user_id,
                action='role_deleted',
                target_type='Role',
                target_id=role_id,
                meta_data={
                    'role_name': role.name
                }
            )

            return jsonify({'message': 'Role deleted successfully'}), 200
        else:
            return jsonify({'error': 'Failed to delete role'}), 500

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@roles_bp.route('/api/roles/<int:role_id>/users/<int:user_id>', methods=['POST'])
@jwt_required()
@require_permission('role_manage')
def assign_role_to_user(role_id, user_id):
    """Assign a role to a user"""
    current_user = get_jwt_identity()
    organization_id = current_user.get('organization_id')
    current_user_id = current_user.get('user_id')

    try:
        # Verify role exists and belongs to organization
        role = RoleRepository.get_role_by_id(role_id)
        if not role:
            return jsonify({'error': 'Role not found'}), 404

        if role.organization_id != organization_id:
            return jsonify({'error': 'Unauthorized'}), 403

        # Verify user exists and belongs to organization
        user = UserRepository.get_user_by_id(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        if user.organization_id != organization_id:
            return jsonify({'error': 'Unauthorized'}), 403

        # Assign role
        user_role = RoleRepository.assign_role_to_user(user_id, role_id)

        # Log audit
        log_audit(
            organization_id=organization_id,
            user_id=current_user_id,
            action='role_assigned',
            target_type='User',
            target_id=user_id,
            meta_data={
                'role_name': role.name,
                'role_id': role_id
            }
        )

        return jsonify({
            'message': f'Role "{role.name}" assigned to user successfully',
            'user_role_id': user_role.user_role_id
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@roles_bp.route('/api/roles/<int:role_id>/users/<int:user_id>', methods=['DELETE'])
@jwt_required()
@require_permission('role_manage')
def remove_role_from_user(role_id, user_id):
    """Remove a role from a user"""
    current_user = get_jwt_identity()
    organization_id = current_user.get('organization_id')
    current_user_id = current_user.get('user_id')

    try:
        # Verify role exists and belongs to organization
        role = RoleRepository.get_role_by_id(role_id)
        if not role:
            return jsonify({'error': 'Role not found'}), 404

        if role.organization_id != organization_id:
            return jsonify({'error': 'Unauthorized'}), 403

        # Verify user exists and belongs to organization
        user = UserRepository.get_user_by_id(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        if user.organization_id != organization_id:
            return jsonify({'error': 'Unauthorized'}), 403

        # Remove role
        success = RoleRepository.remove_role_from_user(user_id, role_id)

        if success:
            # Log audit
            log_audit(
                organization_id=organization_id,
                user_id=current_user_id,
                action='role_removed',
                target_type='User',
                target_id=user_id,
                meta_data={
                    'role_name': role.name,
                    'role_id': role_id
                }
            )

            return jsonify({
                'message': f'Role "{role.name}" removed from user successfully'
            }), 200
        else:
            return jsonify({'error': 'User does not have this role'}), 404

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@roles_bp.route('/api/permissions', methods=['GET'])
@jwt_required()
def get_available_permissions():
    """Get list of all available permissions in the system"""
    try:
        # Define all available permissions
        permissions = [
            {'name': 'document_view', 'description': 'View documents'},
            {'name': 'document_upload', 'description': 'Upload documents'},
            {'name': 'document_delete', 'description': 'Delete documents'},
            {'name': 'document_manage', 'description': 'Full document management'},
            {'name': 'user_manage', 'description': 'Manage users'},
            {'name': 'role_manage', 'description': 'Manage roles and permissions'},
            {'name': 'policy_manage', 'description': 'Manage security policies'},
            {'name': 'audit_view', 'description': 'View audit logs'},
            {'name': 'canary_manage', 'description': 'Manage canary tokens'},
            {'name': 'rag_query', 'description': 'Query RAG system'},
            {'name': 'admin_full', 'description': 'Full administrative access'}
        ]

        return jsonify({'permissions': permissions}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
