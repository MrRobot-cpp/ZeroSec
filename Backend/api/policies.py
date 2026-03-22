"""
Policy Management API
Handles security policy CRUD operations
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from backend.database.repository import PolicyRepository
from backend.utils.audit import log_audit
from backend.utils.rbac import require_permission

policies_bp = Blueprint("policies_bp", __name__)

# Sensitive config keys whose values are masked in GET responses
_RAG_SENSITIVE_KEYS = {"groq_api_key", "qdrant_api_key"}

def _mask_rag_config(config: dict) -> dict:
    """Return a copy of the rag_provider config with API keys masked."""
    if not config:
        return config
    masked = dict(config)
    for key in _RAG_SENSITIVE_KEYS:
        val = masked.get(key)
        if val:
            masked[key] = val[:7] + "****" if len(val) > 7 else "****"
    return masked


@policies_bp.route('/api/policies', methods=['GET'])
@jwt_required()
def get_policies():
    """Get all policies for the user's organization"""
    from flask_jwt_extended import get_jwt
    claims = get_jwt()
    organization_id = claims.get('organization_id')

    try:
        # Get optional query parameters
        policy_type = request.args.get('type')
        enabled_only = request.args.get('enabled_only', 'false').lower() == 'true'

        if policy_type:
            policies = PolicyRepository.get_policies_by_type(organization_id, policy_type)
        elif enabled_only:
            policies = PolicyRepository.get_enabled_policies(organization_id)
        else:
            policies = PolicyRepository.get_all_policies(organization_id)

        policies_data = [{
            'policy_id': policy.policy_id,
            'policy_type': policy.policy_type,
            'config': _mask_rag_config(policy.config) if policy.policy_type == 'rag_provider' else policy.config,
            'enabled': policy.enabled
        } for policy in policies]

        return jsonify({'policies': policies_data}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@policies_bp.route('/api/policies/<int:policy_id>', methods=['GET'])
@jwt_required()
def get_policy(policy_id):
    """Get a specific policy by ID"""
    from flask_jwt_extended import get_jwt
    claims = get_jwt()
    organization_id = claims.get('organization_id')

    try:
        policy = PolicyRepository.get_policy_by_id(policy_id)

        if not policy:
            return jsonify({'error': 'Policy not found'}), 404

        # Verify policy belongs to user's organization
        if policy.organization_id != organization_id:
            return jsonify({'error': 'Unauthorized'}), 403

        policy_data = {
            'policy_id': policy.policy_id,
            'policy_type': policy.policy_type,
            'config': policy.config,
            'enabled': policy.enabled
        }

        return jsonify(policy_data), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@policies_bp.route('/api/policies', methods=['POST'])
@jwt_required()
@require_permission('policy_manage')
def create_policy():
    """Create a new policy"""
    from flask_jwt_extended import get_jwt
    user_id = get_jwt_identity()
    claims = get_jwt()
    organization_id = claims.get('organization_id')

    try:
        data = request.get_json()

        if not data:
            return jsonify({'error': 'Missing request body'}), 400

        policy_type = data.get('policy_type')
        config = data.get('config', {})
        enabled = data.get('enabled', True)

        if not policy_type:
            return jsonify({'error': 'Missing policy_type'}), 400

        # Validate policy type
        valid_types = ['firewall', 'retrieval', 'output', 'canary', 'abac', 'encryption', 'rag_provider', 'firewall_patterns']
        if policy_type not in valid_types:
            return jsonify({'error': f'Invalid policy_type. Must be one of: {", ".join(valid_types)}'}), 400

        # Validate firewall_patterns before saving
        if policy_type == 'firewall_patterns':
            from backend.security.pattern_manager import validate_and_save_patterns
            valid, error = validate_and_save_patterns(organization_id, config)
            if not valid:
                return jsonify({'error': f'Pattern validation failed: {error}'}), 400

        # Create policy
        policy = PolicyRepository.create_policy(
            organization_id=organization_id,
            policy_type=policy_type,
            config=config,
            enabled=enabled
        )

        # Log audit
        log_audit(
            organization_id=organization_id,
            user_id=user_id,
            action='policy_created',
            target_type='Policy',
            target_id=policy.policy_id,
            metadata={
                'policy_type': policy_type,
                'enabled': enabled
            }
        )

        # Re-initialize RAG provider singleton when rag_provider config changes
        if policy_type == 'rag_provider':
            from backend.rag.providers import reset_provider
            reset_provider()

        policy_data = {
            'policy_id': policy.policy_id,
            'policy_type': policy.policy_type,
            'config': _mask_rag_config(policy.config) if policy_type == 'rag_provider' else policy.config,
            'enabled': policy.enabled
        }

        return jsonify({
            'message': 'Policy created successfully',
            'policy': policy_data
        }), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@policies_bp.route('/api/policies/<int:policy_id>', methods=['PUT'])
@jwt_required()
@require_permission('policy_manage')
def update_policy(policy_id):
    """Update an existing policy"""
    from flask_jwt_extended import get_jwt
    user_id = get_jwt_identity()
    claims = get_jwt()
    organization_id = claims.get('organization_id')

    try:
        # Verify policy exists and belongs to organization
        policy = PolicyRepository.get_policy_by_id(policy_id)
        if not policy:
            return jsonify({'error': 'Policy not found'}), 404

        if policy.organization_id != organization_id:
            return jsonify({'error': 'Unauthorized'}), 403

        data = request.get_json()
        if not data:
            return jsonify({'error': 'Missing request body'}), 400

        policy_type = data.get('policy_type')
        config = data.get('config')
        enabled = data.get('enabled')

        # For rag_provider: merge submitted config with existing (empty/masked fields = keep existing)
        if policy.policy_type == 'rag_provider' and config:
            existing_config = policy.config or {}
            merged = dict(existing_config)
            for k, v in config.items():
                # Skip empty strings and masked values (ending with ****)
                if v is not None and v != "" and not (isinstance(v, str) and v.endswith("****")):
                    merged[k] = v
            config = merged

        # Validate firewall_patterns before updating
        if policy.policy_type == 'firewall_patterns' and config:
            from backend.security.pattern_manager import validate_and_save_patterns
            valid, error = validate_and_save_patterns(organization_id, config)
            if not valid:
                return jsonify({'error': f'Pattern validation failed: {error}'}), 400

        # Update policy
        updated_policy = PolicyRepository.update_policy(
            policy_id=policy_id,
            policy_type=policy_type,
            config=config,
            enabled=enabled
        )

        # Log audit
        log_audit(
            organization_id=organization_id,
            user_id=user_id,
            action='policy_updated',
            target_type='Policy',
            target_id=policy_id,
            metadata={
                'policy_type': updated_policy.policy_type,
                'enabled': updated_policy.enabled
            }
        )

        # Re-initialize RAG provider singleton when rag_provider config changes
        if updated_policy.policy_type == 'rag_provider':
            from backend.rag.providers import reset_provider
            reset_provider()

        policy_data = {
            'policy_id': updated_policy.policy_id,
            'policy_type': updated_policy.policy_type,
            'config': _mask_rag_config(updated_policy.config) if updated_policy.policy_type == 'rag_provider' else updated_policy.config,
            'enabled': updated_policy.enabled
        }

        return jsonify({
            'message': 'Policy updated successfully',
            'policy': policy_data
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@policies_bp.route('/api/policies/<int:policy_id>', methods=['DELETE'])
@jwt_required()
@require_permission('policy_manage')
def delete_policy(policy_id):
    """Delete a policy"""
    from flask_jwt_extended import get_jwt
    user_id = get_jwt_identity()
    claims = get_jwt()
    organization_id = claims.get('organization_id')

    try:
        # Verify policy exists and belongs to organization
        policy = PolicyRepository.get_policy_by_id(policy_id)
        if not policy:
            return jsonify({'error': 'Policy not found'}), 404

        if policy.organization_id != organization_id:
            return jsonify({'error': 'Unauthorized'}), 403

        # Delete policy
        success = PolicyRepository.delete_policy(policy_id)

        if success:
            # Log audit
            log_audit(
                organization_id=organization_id,
                user_id=user_id,
                action='policy_deleted',
                target_type='Policy',
                target_id=policy_id,
                metadata={
                    'policy_type': policy.policy_type
                }
            )

            return jsonify({'message': 'Policy deleted successfully'}), 200
        else:
            return jsonify({'error': 'Failed to delete policy'}), 500

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@policies_bp.route('/api/policies/<int:policy_id>/toggle', methods=['PATCH'])
@jwt_required()
@require_permission('policy_manage')
def toggle_policy(policy_id):
    """Toggle policy enabled/disabled status"""
    from flask_jwt_extended import get_jwt
    user_id = get_jwt_identity()
    claims = get_jwt()
    organization_id = claims.get('organization_id')

    try:
        # Verify policy exists and belongs to organization
        policy = PolicyRepository.get_policy_by_id(policy_id)
        if not policy:
            return jsonify({'error': 'Policy not found'}), 404

        if policy.organization_id != organization_id:
            return jsonify({'error': 'Unauthorized'}), 403

        # Toggle policy
        updated_policy = PolicyRepository.toggle_policy(policy_id)

        # Log audit
        log_audit(
            organization_id=organization_id,
            user_id=user_id,
            action='policy_toggled',
            target_type='Policy',
            target_id=policy_id,
            metadata={
                'policy_type': updated_policy.policy_type,
                'enabled': updated_policy.enabled
            }
        )

        policy_data = {
            'policy_id': updated_policy.policy_id,
            'policy_type': updated_policy.policy_type,
            'config': updated_policy.config,
            'enabled': updated_policy.enabled
        }

        return jsonify({
            'message': f'Policy {"enabled" if updated_policy.enabled else "disabled"} successfully',
            'policy': policy_data
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@policies_bp.route('/api/policies/firewall/reload', methods=['POST'])
@jwt_required()
@require_permission('policy_manage')
def reload_firewall_patterns():
    """Reload firewall patterns from DB without restart"""
    from flask_jwt_extended import get_jwt
    claims = get_jwt()
    organization_id = claims.get('organization_id')

    try:
        from backend.security.pattern_manager import reload_all_patterns
        reload_all_patterns(organization_id)

        return jsonify({
            'message': 'Firewall patterns reloaded successfully',
            'org_id': organization_id
        }), 200

    except Exception as e:
        return jsonify({'error': f'Reload failed: {str(e)}'}), 500
