"""
Dashboard API
Provides metrics and statistics for the dashboard UI
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from backend.database.repository import DashboardRepository

dashboard_bp = Blueprint("dashboard_bp", __name__)


@dashboard_bp.route('/api/dashboard/overview', methods=['GET'])
@jwt_required()
def get_dashboard_overview():
    """Get complete dashboard overview with all metrics"""
    current_user = get_jwt_identity()
    organization_id = current_user.get('organization_id')

    try:
        # Gather all metrics
        document_stats = DashboardRepository.get_document_stats(organization_id)
        security_stats = DashboardRepository.get_security_stats(organization_id)
        user_activity = DashboardRepository.get_user_activity_stats(organization_id)
        policy_stats = DashboardRepository.get_policy_stats(organization_id)
        system_health = DashboardRepository.get_system_health(organization_id)

        overview = {
            'documents': document_stats,
            'security': security_stats,
            'users': user_activity,
            'policies': policy_stats,
            'system_health': system_health
        }

        return jsonify(overview), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@dashboard_bp.route('/api/dashboard/documents', methods=['GET'])
@jwt_required()
def get_document_metrics():
    """Get document-specific metrics"""
    current_user = get_jwt_identity()
    organization_id = current_user.get('organization_id')

    try:
        stats = DashboardRepository.get_document_stats(organization_id)
        return jsonify(stats), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@dashboard_bp.route('/api/dashboard/security', methods=['GET'])
@jwt_required()
def get_security_metrics():
    """Get security-specific metrics"""
    current_user = get_jwt_identity()
    organization_id = current_user.get('organization_id')

    try:
        stats = DashboardRepository.get_security_stats(organization_id)
        return jsonify(stats), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@dashboard_bp.route('/api/dashboard/users', methods=['GET'])
@jwt_required()
def get_user_metrics():
    """Get user activity metrics"""
    current_user = get_jwt_identity()
    organization_id = current_user.get('organization_id')

    try:
        stats = DashboardRepository.get_user_activity_stats(organization_id)
        return jsonify(stats), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@dashboard_bp.route('/api/dashboard/audit', methods=['GET'])
@jwt_required()
def get_audit_metrics():
    """Get audit log summary"""
    current_user = get_jwt_identity()
    organization_id = current_user.get('organization_id')

    # Get optional days parameter (default 7)
    days = request.args.get('days', 7, type=int)

    try:
        stats = DashboardRepository.get_audit_summary(organization_id, days)
        return jsonify(stats), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@dashboard_bp.route('/api/dashboard/policies', methods=['GET'])
@jwt_required()
def get_policy_metrics():
    """Get policy statistics"""
    current_user = get_jwt_identity()
    organization_id = current_user.get('organization_id')

    try:
        stats = DashboardRepository.get_policy_stats(organization_id)
        return jsonify(stats), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@dashboard_bp.route('/api/dashboard/health', methods=['GET'])
@jwt_required()
def get_system_health():
    """Get system health status"""
    current_user = get_jwt_identity()
    organization_id = current_user.get('organization_id')

    try:
        health = DashboardRepository.get_system_health(organization_id)
        return jsonify(health), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@dashboard_bp.route('/api/metrics', methods=['GET'])
@jwt_required()
def get_metrics():
    """Legacy endpoint for backward compatibility - redirects to overview"""
    return get_dashboard_overview()
