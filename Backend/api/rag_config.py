"""
RAG Provider Configuration API
Handles testing of RAG provider config before saving.
Load/save operations go through the standard /api/policies endpoints.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required

rag_config_bp = Blueprint('rag_config', __name__, url_prefix='/api/rag')


@rag_config_bp.route('/test', methods=['POST'])
@jwt_required()
def test_rag_config():
    """
    Test a RAG provider configuration without saving it.
    Instantiates a temporary provider with the submitted config and calls health_check().

    Body: same shape as the rag_provider policy config JSON.
    Returns: health_check() result dict.
    """
    data = request.get_json(force=True) or {}
    provider_mode = data.get('provider', 'local').lower()

    try:
        if provider_mode == 'external':
            from backend.rag.providers.external_provider import ExternalRAGProvider
            # Instantiate directly (not via singleton) using the submitted config
            provider = ExternalRAGProvider(config=data)
            result = provider.health_check()
        else:
            from backend.rag.providers.local_provider import LocalRAGProvider
            provider = LocalRAGProvider()
            result = provider.health_check()

        return jsonify(result), 200

    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 200
