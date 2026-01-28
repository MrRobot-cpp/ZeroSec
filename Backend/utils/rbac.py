"""
Role-Based Access Control (RBAC) utilities
Provides decorators for protecting routes with role and permission checks
"""
from functools import wraps
from flask import jsonify
from flask_jwt_extended import get_jwt, verify_jwt_in_request

def require_permission(permission):
    """
    Decorator to require specific permission

    Usage:
        @require_permission('read')
        def my_route():
            ...
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            try:
                verify_jwt_in_request()
                claims = get_jwt()
                permissions = claims.get('permissions', [])

                if permission not in permissions:
                    print(f"[RBAC DEBUG] Permission denied. Required: '{permission}', User has: {permissions}")
                    return jsonify({
                        'error': 'Permission denied',
                        'required_permission': permission
                    }), 403

                return fn(*args, **kwargs)
            except Exception as e:
                print(f"[RBAC DEBUG] Error in require_permission decorator: {e}")
                raise
        return wrapper
    return decorator

def require_role(role):
    """
    Decorator to require specific role

    Usage:
        @require_role('Admin')
        def my_route():
            ...
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            claims = get_jwt()
            roles = claims.get('roles', [])

            if role not in roles:
                return jsonify({
                    'error': 'Role required',
                    'required_role': role
                }), 403

            return fn(*args, **kwargs)
        return wrapper
    return decorator

def require_any_role(*roles):
    """
    Decorator to require any of the specified roles

    Usage:
        @require_any_role('Admin', 'Manager')
        def my_route():
            ...
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            claims = get_jwt()
            user_roles = claims.get('roles', [])

            if not any(role in user_roles for role in roles):
                return jsonify({
                    'error': 'Insufficient role privileges',
                    'required_roles': list(roles)
                }), 403

            return fn(*args, **kwargs)
        return wrapper
    return decorator

def require_all_roles(*roles):
    """
    Decorator to require all specified roles

    Usage:
        @require_all_roles('Admin', 'Manager')
        def my_route():
            ...
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            claims = get_jwt()
            user_roles = claims.get('roles', [])

            if not all(role in user_roles for role in roles):
                return jsonify({
                    'error': 'All required roles not present',
                    'required_roles': list(roles)
                }), 403

            return fn(*args, **kwargs)
        return wrapper
    return decorator

def require_any_permission(*permissions):
    """
    Decorator to require any of the specified permissions

    Usage:
        @require_any_permission('read', 'write')
        def my_route():
            ...
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            claims = get_jwt()
            user_permissions = claims.get('permissions', [])

            if not any(perm in user_permissions for perm in permissions):
                return jsonify({
                    'error': 'Insufficient permissions',
                    'required_permissions': list(permissions)
                }), 403

            return fn(*args, **kwargs)
        return wrapper
    return decorator

def get_current_user_id():
    """Get current user ID from JWT"""
    from flask_jwt_extended import get_jwt_identity
    return get_jwt_identity()

def get_current_organization_id():
    """Get current organization ID from JWT"""
    try:
        verify_jwt_in_request()
        claims = get_jwt()
        org_id = claims.get('organization_id')
        if org_id is None:
            print(f"[RBAC DEBUG] No organization_id in JWT claims. Claims: {claims}")
        return org_id
    except Exception as e:
        print(f"[RBAC DEBUG] Error getting organization_id: {e}")
        raise

def has_permission(permission):
    """Check if current user has permission"""
    claims = get_jwt()
    permissions = claims.get('permissions', [])
    return permission in permissions

def has_role(role):
    """Check if current user has role"""
    claims = get_jwt()
    roles = claims.get('roles', [])
    return role in roles
