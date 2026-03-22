"""
Usage Metrics API
Tracks and reports usage metrics for subscriptions
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from backend.database.repository import SubscriptionRepository
from backend.database.models import UsageMetric, Subscription
from backend.database.db import db
from datetime import datetime, timedelta, timezone

metrics_bp = Blueprint("metrics_bp", __name__)


@metrics_bp.route('/api/metrics/usage', methods=['GET'])
@jwt_required()
def get_current_usage():
    """Get current usage metrics for organization's subscription"""
    from flask_jwt_extended import get_jwt
    claims = get_jwt()
    organization_id = claims.get('organization_id')

    try:
        # Get organization's subscription
        subscription = SubscriptionRepository.get_organization_subscription(organization_id)

        if not subscription:
            return jsonify({'error': 'No active subscription found'}), 404

        # Get current month's metrics
        current_month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        metrics = UsageMetric.query.filter(
            UsageMetric.subscription_id == subscription.subscription_id,
            UsageMetric.recorded_at >= current_month_start
        ).all()

        # Aggregate metrics by type
        usage_summary = {}
        for metric in metrics:
            if metric.metric_type not in usage_summary:
                usage_summary[metric.metric_type] = 0
            usage_summary[metric.metric_type] += metric.metric_value

        # Get plan limits
        plan_limits = subscription.plan.limits if subscription.plan else {}

        # Calculate usage vs limits
        usage_data = {
            'subscription_id': subscription.subscription_id,
            'plan_name': subscription.plan.name if subscription.plan else None,
            'billing_period': {
                'start': current_month_start.isoformat(),
                'end': (current_month_start + timedelta(days=30)).isoformat()
            },
            'usage': usage_summary,
            'limits': plan_limits,
            'percentage_used': {}
        }

        # Calculate percentage used for each metric
        for metric_type, limit in plan_limits.items():
            if limit > 0:  # Only calculate if limit is set
                usage_value = usage_summary.get(metric_type, 0)
                usage_data['percentage_used'][metric_type] = round(
                    (usage_value / limit) * 100, 2
                )

        return jsonify({'usage': usage_data}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@metrics_bp.route('/api/metrics/history', methods=['GET'])
@jwt_required()
def get_usage_history():
    """Get historical usage metrics"""
    from flask_jwt_extended import get_jwt
    claims = get_jwt()
    organization_id = claims.get('organization_id')

    try:
        # Get query parameters
        days = request.args.get('days', default=30, type=int)
        metric_type = request.args.get('type', default=None, type=str)

        # Get organization's subscription
        subscription = SubscriptionRepository.get_organization_subscription(organization_id)

        if not subscription:
            return jsonify({'error': 'No active subscription found'}), 404

        # Calculate date range
        end_date = datetime.now(timezone.utc)
        start_date = end_date - timedelta(days=days)

        # Query metrics
        query = UsageMetric.query.filter(
            UsageMetric.subscription_id == subscription.subscription_id,
            UsageMetric.recorded_at >= start_date,
            UsageMetric.recorded_at <= end_date
        )

        # Filter by metric type if specified
        if metric_type:
            query = query.filter(UsageMetric.metric_type == metric_type)

        metrics = query.order_by(UsageMetric.recorded_at.asc()).all()

        # Format metrics
        metrics_data = [{
            'usage_metric_id': metric.usage_metric_id,
            'metric_type': metric.metric_type,
            'metric_value': metric.metric_value,
            'recorded_at': metric.recorded_at.isoformat()
        } for metric in metrics]

        # Group by day for easier visualization
        daily_usage = {}
        for metric in metrics:
            day = metric.recorded_at.date().isoformat()
            if day not in daily_usage:
                daily_usage[day] = {}

            metric_type_key = metric.metric_type
            if metric_type_key not in daily_usage[day]:
                daily_usage[day][metric_type_key] = 0

            daily_usage[day][metric_type_key] += metric.metric_value

        return jsonify({
            'history': {
                'period': {
                    'start': start_date.isoformat(),
                    'end': end_date.isoformat(),
                    'days': days
                },
                'metrics': metrics_data,
                'daily_summary': daily_usage
            }
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@metrics_bp.route('/api/metrics/limits', methods=['GET'])
@jwt_required()
def get_limits():
    """Get plan limits vs current usage"""
    from flask_jwt_extended import get_jwt
    claims = get_jwt()
    organization_id = claims.get('organization_id')

    try:
        # Get organization's subscription
        subscription = SubscriptionRepository.get_organization_subscription(organization_id)

        if not subscription:
            return jsonify({'error': 'No active subscription found'}), 404

        # Get plan limits
        plan_limits = subscription.plan.limits if subscription.plan else {}

        # Get current month's usage
        current_month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        metrics = UsageMetric.query.filter(
            UsageMetric.subscription_id == subscription.subscription_id,
            UsageMetric.recorded_at >= current_month_start
        ).all()

        # Aggregate current usage
        current_usage = {}
        for metric in metrics:
            if metric.metric_type not in current_usage:
                current_usage[metric.metric_type] = 0
            current_usage[metric.metric_type] += metric.metric_value

        # Build limits comparison
        limits_data = []
        for metric_type, limit in plan_limits.items():
            usage = current_usage.get(metric_type, 0)

            limits_data.append({
                'metric_type': metric_type,
                'limit': limit,
                'current_usage': usage,
                'remaining': max(0, limit - usage) if limit > 0 else -1,
                'percentage_used': round((usage / limit) * 100, 2) if limit > 0 else 0,
                'is_exceeded': usage > limit if limit > 0 else False
            })

        return jsonify({
            'plan_name': subscription.plan.name if subscription.plan else None,
            'limits': limits_data,
            'billing_period': {
                'start': current_month_start.isoformat(),
                'end': (current_month_start + timedelta(days=30)).isoformat()
            }
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@metrics_bp.route('/api/metrics/record', methods=['POST'])
@jwt_required()
def record_metric():
    """Record a new usage metric (internal use / API)"""
    from flask_jwt_extended import get_jwt
    claims = get_jwt()
    organization_id = claims.get('organization_id')

    try:
        data = request.get_json()

        # Validate required fields
        if not data.get('metric_type'):
            return jsonify({'error': 'metric_type is required'}), 400
        if not data.get('metric_value'):
            return jsonify({'error': 'metric_value is required'}), 400

        # Get organization's subscription
        subscription = SubscriptionRepository.get_organization_subscription(organization_id)

        if not subscription:
            return jsonify({'error': 'No active subscription found'}), 404

        # Record metric
        metric = SubscriptionRepository.record_usage_metric(
            subscription_id=subscription.subscription_id,
            metric_type=data['metric_type'],
            metric_value=data['metric_value']
        )

        return jsonify({
            'message': 'Usage metric recorded successfully',
            'metric': {
                'usage_metric_id': metric.usage_metric_id,
                'metric_type': metric.metric_type,
                'metric_value': metric.metric_value,
                'recorded_at': metric.recorded_at.isoformat()
            }
        }), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@metrics_bp.route('/api/metrics/summary', methods=['GET'])
@jwt_required()
def get_summary():
    """Get usage summary with trending data"""
    from flask_jwt_extended import get_jwt
    claims = get_jwt()
    organization_id = claims.get('organization_id')

    try:
        # Get organization's subscription
        subscription = SubscriptionRepository.get_organization_subscription(organization_id)

        if not subscription:
            return jsonify({'error': 'No active subscription found'}), 404

        # Current month
        current_month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # Last month
        last_month_end = current_month_start - timedelta(days=1)
        last_month_start = last_month_end.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # Get current month metrics
        current_metrics = UsageMetric.query.filter(
            UsageMetric.subscription_id == subscription.subscription_id,
            UsageMetric.recorded_at >= current_month_start
        ).all()

        # Get last month metrics
        last_metrics = UsageMetric.query.filter(
            UsageMetric.subscription_id == subscription.subscription_id,
            UsageMetric.recorded_at >= last_month_start,
            UsageMetric.recorded_at < current_month_start
        ).all()

        # Aggregate
        current_usage = {}
        for metric in current_metrics:
            if metric.metric_type not in current_usage:
                current_usage[metric.metric_type] = 0
            current_usage[metric.metric_type] += metric.metric_value

        last_usage = {}
        for metric in last_metrics:
            if metric.metric_type not in last_usage:
                last_usage[metric.metric_type] = 0
            last_usage[metric.metric_type] += metric.metric_value

        # Calculate trends
        trends = {}
        for metric_type in current_usage:
            current = current_usage[metric_type]
            previous = last_usage.get(metric_type, 0)

            if previous > 0:
                change_percentage = round(((current - previous) / previous) * 100, 2)
            else:
                change_percentage = 100 if current > 0 else 0

            trends[metric_type] = {
                'current': current,
                'previous': previous,
                'change': current - previous,
                'change_percentage': change_percentage,
                'trend': 'up' if current > previous else 'down' if current < previous else 'stable'
            }

        return jsonify({
            'summary': {
                'current_month': current_usage,
                'last_month': last_usage,
                'trends': trends,
                'plan': subscription.plan.name if subscription.plan else None
            }
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
