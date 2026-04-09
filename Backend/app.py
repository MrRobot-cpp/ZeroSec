import sys
# Fix Windows cp1252 crashes on Unicode output (Arabic text, PDF symbols, etc.)
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from flask import Flask, request, jsonify, Response
# jwt_required used inline in /logs via verify_jwt_in_request
from flask_cors import CORS
import os

from backend.config import config
from backend.database.db import init_db
from backend.services.rag_service import query_rag
from backend.services.logging_service import (
    stream_logs,
    get_logs,
    log_decision,
    start_log_poller,
)
from backend.api.documents import documents_bp
from backend.api.canary import canary_bp
from backend.api.auth import auth_bp
from backend.api.logs import logs_bp
from backend.api.policies import policies_bp
from backend.api.roles import roles_bp
from backend.api.users import users_bp
from backend.api.dashboard import dashboard_bp
from backend.api.subscriptions import subscriptions_bp
from backend.api.metrics import metrics_bp
from backend.api.rag_config import rag_config_bp
from backend.api.secure_query import secure_query_bp

# Get environment
env = os.getenv('FLASK_ENV', 'development')

# Create Flask app
app = Flask("zerosec_api")

# Load configuration
app.config.from_object(config[env])

# Initialize CORS
CORS(app, expose_headers=['X-Canary-ID', 'X-Output-Path', 'X-Canary-Hash', 'X-Canary-Meta', 'Content-Disposition'])

# Initialize database
init_db(app)

# Register blueprints
app.register_blueprint(auth_bp)
app.register_blueprint(documents_bp)
app.register_blueprint(canary_bp)
app.register_blueprint(logs_bp)
app.register_blueprint(policies_bp)
app.register_blueprint(roles_bp)
app.register_blueprint(users_bp)
app.register_blueprint(dashboard_bp)
app.register_blueprint(subscriptions_bp)
app.register_blueprint(metrics_bp)
app.register_blueprint(rag_config_bp)
app.register_blueprint(secure_query_bp)

@app.route("/query", methods=["POST"])
def query_route():
    """Query RAG system"""
    try:
        data = request.get_json(force=True)
        question = data.get("question", "")

        result = query_rag(question)
        log_decision(question, result)

        return jsonify(result)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"decision": "BLOCK", "reason": f"server_error: {e}", "sources": []}), 500

@app.route("/api/rag/health", methods=["GET"])
def rag_health():
    """Return current RAG provider health and configuration."""
    from backend.rag.providers import get_provider
    try:
        return jsonify(get_provider().health_check())
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500

@app.route("/logs")
def logs():
    """Logs endpoint - returns firewall CSV logs + audit logs (DB)"""
    try:
        from backend.database.models import AuditLog
        from backend.database.db import db

        # Default org — security logs are cross-org visible for now
        organization_id = 1

        # Get audit logs filtered by organization
        audit_logs = AuditLog.query.filter_by(
            organization_id=organization_id
        ).order_by(AuditLog.created_at.desc()).limit(100).all()

        # Get firewall logs
        combined_logs = get_logs()

        # Security action mappings for proper log categorization
        BLOCK_ACTIONS = {
            'canary_token_triggered',
            'unauthorized_access',
            'policy_violation',
            'llm_judge_block',
            'firewall_injection_block',
            'firewall_canary_block',
            'pii_data_leak',
        }
        REASON_MAP = {
            'canary_token_triggered': 'Insider Threat — Canary Token',
            'llm_judge_block': 'LLM Judge — Malicious Chunk Detected',
            'firewall_injection_block': 'Firewall — Prompt Injection',
            'firewall_canary_block': 'Firewall — Canary Token in Query',
            'pii_data_leak': 'Data Leak — PII Redacted in Response',
            'unauthorized_access': 'Unauthorized Access',
            'policy_violation': 'Policy Violation',
        }
        STOPPED_BY_MAP = {
            'llm_judge_block': 'LLM Judge (Groq)',
            'firewall_injection_block': 'Regex + ML Firewall',
            'firewall_canary_block': 'Canary Detection',
            'pii_data_leak': 'PII Redaction Engine',
            'canary_token_triggered': 'Canary Triggers',
        }

        # Add audit logs to the response
        for log in audit_logs:
            try:
                username = log.user.username if log.user else 'system'
            except Exception:
                username = 'system'

            action = log.action
            meta = log.meta_data or {}
            is_block = action in BLOCK_ACTIONS

            # Build rich query field — use the actual query from metadata if available
            query_text = meta.get('query') or meta.get('reason') or action

            combined_logs.append({
                'id': log.audit_id,
                'timestamp': log.created_at.isoformat(),
                'query': query_text,
                'decision': 'BLOCK' if is_block else 'ALLOW',
                'reason': REASON_MAP.get(action, log.target_type or action),
                'stopped_by': STOPPED_BY_MAP.get(action, username),
                'action': action,
                'metadata': meta,
                'type': 'audit'
            })

        return jsonify(combined_logs)
    except Exception as e:
        print(f"Error in /logs endpoint: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route("/stream")
def stream():
    return Response(stream_logs(), content_type="text/event-stream")

# Legacy document endpoints for frontend compatibility (no auth required for basic operations)
@app.route("/documents", methods=["GET"])
def legacy_get_documents():
    """Legacy documents endpoint without authentication"""
    from backend.database.repository import DocumentRepository
    from backend.database.models import Organization

    try:
        # Get default organization documents
        org = Organization.query.first()
        if not org:
            return jsonify({'documents': []})

        docs = DocumentRepository.get_all_documents(org.organization_id)

        from pathlib import Path
        DOCS_PATH = Path(__file__).resolve().parent / "data" / "docs"

        documents = []
        for doc in docs:
            file_path = DOCS_PATH / doc.filename
            file_size = file_path.stat().st_size if file_path.exists() else 0

            documents.append({
                'id': doc.document_id,
                'name': doc.filename,
                'sensitivity': doc.sensitivity,
                'clearance_level': doc.clearance_level.name if doc.clearance_level else None,
                'size': file_size,
                'uploaded_at': doc.created_at.isoformat(),
                'status': 'Uploaded'
            })

        return jsonify({'documents': documents})
    except Exception as e:
        print(f"Error in legacy_get_documents: {e}")
        return jsonify({'documents': [], 'error': str(e)}), 500

@app.route("/documents/upload", methods=["POST"])
def legacy_upload_document():
    """Legacy document upload endpoint without authentication"""
    from backend.database.repository import DocumentRepository
    from backend.database.models import Organization
    from werkzeug.utils import secure_filename
    from pathlib import Path

    try:
        # Get default organization
        org = Organization.query.first()
        if not org:
            return jsonify({'error': 'No organization found'}), 404

        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400

        file = request.files['file']

        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        # Secure the filename
        filename = secure_filename(file.filename)
        DOCS_PATH = Path(__file__).resolve().parent / "data" / "docs"
        DOCS_PATH.mkdir(parents=True, exist_ok=True)
        file_path = DOCS_PATH / filename

        # Check if document already exists
        existing_doc = DocumentRepository.get_document_by_filename(org.organization_id, filename)
        if existing_doc:
            return jsonify({'error': 'Document already exists'}), 409

        # Save the file
        file.save(str(file_path))

        # Get sensitivity from form data
        sensitivity = request.form.get('sensitivity', 'Medium')
        if sensitivity.lower() not in ['high', 'medium', 'low']:
            sensitivity = 'Medium'
        else:
            sensitivity = sensitivity.capitalize()

        # Create document in database
        document = DocumentRepository.create_document(
            organization_id=org.organization_id,
            filename=filename,
            storage_ref=str(file_path),
            sensitivity=sensitivity,
            user_id=None  # No user for legacy endpoint
        )

        # Log audit event
        try:
            from backend.utils.audit import log_audit
            log_audit(
                organization_id=org.organization_id,
                user_id=None,
                action='document_uploaded',
                target_type='Document',
                target_id=document.document_id,
                metadata={
                    'filename': filename,
                    'sensitivity': sensitivity,
                    'source': 'legacy_api'
                }
            )
        except Exception as e:
            print(f"Failed to log audit: {e}")

        # Route based on sensitivity
        if sensitivity == 'High':
            try:
                from backend.api.documents import _ingest_high_sensitivity, extract_text_from_file
                text_content = extract_text_from_file(file_path)
                _ingest_high_sensitivity(file_path, filename, str(document.document_id), text_content)
            except Exception as e:
                print(f"[HIGH ingest] failed in legacy endpoint: {e}")
        else:
            # Standard pipeline — refresh Chroma vectorstore
            try:
                from backend.services.rag_service import refresh_retriever
                refresh_retriever()
            except Exception:
                pass

        return jsonify({
            'message': 'File uploaded successfully',
            'document': {
                'id': document.document_id,
                'name': filename,
                'sensitivity': sensitivity
            }
        }), 201

    except Exception as e:
        print(f"Error in legacy_upload_document: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route("/documents/<path:filename>", methods=["DELETE"])
def legacy_delete_document(filename):
    """Legacy document delete by filename"""
    from backend.database.repository import DocumentRepository
    from backend.database.models import Organization, Document
    from pathlib import Path
    from werkzeug.utils import secure_filename

    try:
        # Get default organization
        org = Organization.query.first()
        if not org:
            return jsonify({'error': 'No organization found'}), 404

        # Find document by filename
        filename = secure_filename(filename)
        doc = Document.query.filter_by(
            organization_id=org.organization_id,
            filename=filename
        ).first()

        if not doc:
            return jsonify({'error': 'Document not found'}), 404

        # Delete file
        DOCS_PATH = Path(__file__).resolve().parent / "data" / "docs"
        file_path = DOCS_PATH / filename
        if file_path.exists():
            file_path.unlink()

        # Delete from database
        DocumentRepository.delete_document(doc.document_id)

        return jsonify({'message': 'Document deleted successfully'}), 200
    except Exception as e:
        print(f"Error in legacy_delete_document: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == "__main__":
    start_log_poller()
    app.run(host="0.0.0.0", port=5200, debug=False)
