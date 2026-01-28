"""
Audit Logs API endpoints
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from backend.utils.rbac import require_any_role, get_current_organization_id
from backend.utils.audit import get_audit_logs, get_user_activity

logs_bp = Blueprint('logs', __name__, url_prefix='/api')

@logs_bp.route('/audit-logs', methods=['GET'])
@jwt_required()
@require_any_role('Admin', 'Super Admin')
def get_audit_logs_route():
    """Get audit logs (Admin only)"""
    try:
        organization_id = get_current_organization_id()

        # Get query parameters
        user_id = request.args.get('user_id', type=int)
        action = request.args.get('action')
        target_type = request.args.get('target_type')
        limit = request.args.get('limit', default=100, type=int)
        offset = request.args.get('offset', default=0, type=int)

        # Get logs
        logs = get_audit_logs(
            organization_id=organization_id,
            user_id=user_id,
            action=action,
            target_type=target_type,
            limit=min(limit, 1000),  # Max 1000
            offset=offset
        )

        return jsonify({
            'logs': logs,
            'count': len(logs)
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@logs_bp.route('/my-activity', methods=['GET'])
@jwt_required()
def get_my_activity():
    """Get current user's activity"""
    try:
        user_id = get_jwt_identity()
        limit = request.args.get('limit', default=50, type=int)

        activity = get_user_activity(user_id, limit=min(limit, 200))

        return jsonify({
            'activity': activity,
            'count': len(activity)
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
