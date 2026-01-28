"""
Subscription Management API
Handles organization subscriptions and plan management
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from backend.database.repository import SubscriptionRepository
from backend.database.models import Plan
from backend.utils.audit import log_audit
from backend.utils.rbac import require_permission

subscriptions_bp = Blueprint("subscriptions_bp", __name__)


@subscriptions_bp.route('/api/subscriptions', methods=['GET'])
@jwt_required()
def get_subscription():
    """Get organization's current subscription"""
    from flask_jwt_extended import get_jwt
    claims = get_jwt()
    organization_id = claims.get('organization_id')

    try:
        subscription = SubscriptionRepository.get_organization_subscription(organization_id)

        if not subscription:
            return jsonify({'error': 'No subscription found'}), 404

        subscription_data = {
            'subscription_id': subscription.subscription_id,
            'organization_id': subscription.organization_id,
            'plan_id': subscription.plan_id,
            'plan_name': subscription.plan.name if subscription.plan else None,
            'plan_features': subscription.plan.features_page if subscription.plan else None,
            'plan_limits': subscription.plan.limits if subscription.plan else {},
            'status': subscription.status,
            'start_date': subscription.start_date.isoformat() if subscription.start_date else None,
            'end_date': subscription.end_date.isoformat() if subscription.end_date else None,
            'auto_renew': subscription.auto_renew
        }

        return jsonify({'subscription': subscription_data}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@subscriptions_bp.route('/api/subscriptions', methods=['POST'])
@jwt_required()
@require_permission('admin')
def create_subscription():
    """Create a new subscription for organization"""
    from flask_jwt_extended import get_jwt
    user_id = get_jwt_identity()
    claims = get_jwt()
    organization_id = claims.get('organization_id')

    try:
        data = request.get_json()

        # Validate required fields
        if not data.get('plan_id'):
            return jsonify({'error': 'plan_id is required'}), 400

        # Create subscription
        subscription = SubscriptionRepository.create_subscription(
            organization_id=organization_id,
            plan_id=data['plan_id'],
            start_date=data.get('start_date'),
            end_date=data.get('end_date'),
            auto_renew=data.get('auto_renew', True)
        )

        # Log audit event
        log_audit(
            organization_id=organization_id,
            user_id=user_id,
            action='subscription_created',
            target_type='Subscription',
            target_id=subscription.subscription_id,
            meta_data={
                'plan_id': data['plan_id']
            }
        )

        subscription_data = {
            'subscription_id': subscription.subscription_id,
            'organization_id': subscription.organization_id,
            'plan_id': subscription.plan_id,
            'status': subscription.status,
            'start_date': subscription.start_date.isoformat() if subscription.start_date else None,
            'end_date': subscription.end_date.isoformat() if subscription.end_date else None
        }

        return jsonify({
            'message': 'Subscription created successfully',
            'subscription': subscription_data
        }), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@subscriptions_bp.route('/api/subscriptions/<int:subscription_id>', methods=['PUT'])
@jwt_required()
@require_permission('admin')
def update_subscription(subscription_id):
    """Update subscription details"""
    from flask_jwt_extended import get_jwt
    user_id = get_jwt_identity()
    claims = get_jwt()
    organization_id = claims.get('organization_id')

    try:
        data = request.get_json()

        # Update subscription
        subscription = SubscriptionRepository.update_subscription(
            subscription_id=subscription_id,
            plan_id=data.get('plan_id'),
            status=data.get('status'),
            end_date=data.get('end_date'),
            auto_renew=data.get('auto_renew')
        )

        if not subscription:
            return jsonify({'error': 'Subscription not found'}), 404

        # Log audit event
        log_audit(
            organization_id=organization_id,
            user_id=user_id,
            action='subscription_updated',
            target_type='Subscription',
            target_id=subscription.subscription_id,
            meta_data=data
        )

        subscription_data = {
            'subscription_id': subscription.subscription_id,
            'organization_id': subscription.organization_id,
            'plan_id': subscription.plan_id,
            'status': subscription.status,
            'end_date': subscription.end_date.isoformat() if subscription.end_date else None,
            'auto_renew': subscription.auto_renew
        }

        return jsonify({
            'message': 'Subscription updated successfully',
            'subscription': subscription_data
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@subscriptions_bp.route('/api/subscriptions/plans', methods=['GET'])
@jwt_required()
def get_plans():
    """Get all available subscription plans"""
    try:
        plans = Plan.query.all()

        plans_data = [{
            'plan_id': plan.plan_id,
            'name': plan.name,
            'features': plan.features_page,
            'limits': plan.limits,
            'created_at': plan.created_at.isoformat() if plan.created_at else None
        } for plan in plans]

        return jsonify({'plans': plans_data}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@subscriptions_bp.route('/api/subscriptions/upgrade', methods=['POST'])
@jwt_required()
@require_permission('admin')
def upgrade_plan():
    """Upgrade subscription to a new plan"""
    from flask_jwt_extended import get_jwt
    user_id = get_jwt_identity()
    claims = get_jwt()
    organization_id = claims.get('organization_id')

    try:
        data = request.get_json()

        # Validate required fields
        if not data.get('new_plan_id'):
            return jsonify({'error': 'new_plan_id is required'}), 400

        # Get current subscription
        current_subscription = SubscriptionRepository.get_organization_subscription(organization_id)

        if not current_subscription:
            return jsonify({'error': 'No active subscription found'}), 404

        # Update to new plan
        subscription = SubscriptionRepository.update_subscription(
            subscription_id=current_subscription.subscription_id,
            plan_id=data['new_plan_id']
        )

        # Log audit event
        log_audit(
            organization_id=organization_id,
            user_id=user_id,
            action='subscription_upgraded',
            target_type='Subscription',
            target_id=subscription.subscription_id,
            meta_data={
                'old_plan_id': current_subscription.plan_id,
                'new_plan_id': data['new_plan_id']
            }
        )

        return jsonify({
            'message': 'Subscription upgraded successfully',
            'subscription': {
                'subscription_id': subscription.subscription_id,
                'plan_id': subscription.plan_id,
                'plan_name': subscription.plan.name if subscription.plan else None
            }
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@subscriptions_bp.route('/api/subscriptions/cancel', methods=['POST'])
@jwt_required()
@require_permission('admin')
def cancel_subscription():
    """Cancel organization's subscription"""
    from flask_jwt_extended import get_jwt
    user_id = get_jwt_identity()
    claims = get_jwt()
    organization_id = claims.get('organization_id')

    try:
        # Get current subscription
        subscription = SubscriptionRepository.get_organization_subscription(organization_id)

        if not subscription:
            return jsonify({'error': 'No active subscription found'}), 404

        # Update status to cancelled
        subscription = SubscriptionRepository.update_subscription(
            subscription_id=subscription.subscription_id,
            status='Cancelled',
            auto_renew=False
        )

        # Log audit event
        log_audit(
            organization_id=organization_id,
            user_id=user_id,
            action='subscription_cancelled',
            target_type='Subscription',
            target_id=subscription.subscription_id
        )

        return jsonify({
            'message': 'Subscription cancelled successfully',
            'subscription_id': subscription.subscription_id
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
