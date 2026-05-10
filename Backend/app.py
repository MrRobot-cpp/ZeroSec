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
from backend.api.attributes import attributes_bp
from backend.api.anomaly import anomaly_bp
from backend.api.red_team import red_team_bp

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

# Register anomaly detector as an observer on the audit log pipeline
from backend.security.anomaly_detection import get_detector, register_app as _ad_register_app
from backend.utils.audit import register_subscriber as _register_audit_subscriber
_ad_register_app(app)
_register_audit_subscriber(get_detector())

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
app.register_blueprint(attributes_bp)
app.register_blueprint(anomaly_bp)
app.register_blueprint(red_team_bp)

@app.route("/query", methods=["POST"])
def query_route():
    """Query RAG system"""
    from backend.utils.audit import log_audit
    try:
        data = request.get_json(force=True)
        question = data.get("question", "")

        # Try to get user identity for auditing
        user_id = None
        org_id = 1
        try:
            from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity, get_jwt
            verify_jwt_in_request(optional=True)
            user_id = get_jwt_identity()
            org_id = get_jwt().get("organization_id", 1)
        except Exception:
            pass

        result = query_rag(question, org_id=org_id, user_id=user_id)
        print(f"--- RAG RESULT DEBUG --- Decision: {result.get('decision')}, Reason: {result.get('reason')}")
        log_decision(question, result)

        # Log audit event for anomaly detection
        log_audit(
            organization_id=org_id,
            user_id=user_id,
            action="rag_query",
            target_type="RAG",
            metadata={
                "query": question[:200],
                "decision": result.get("decision", "ALLOW"),
                "reason": result.get("reason", "Encrypted RAG Query"),
                "stopped_by": result.get("stopped_by", "Encrypted Pipeline")
            }
        )

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

def _anomaly_reason(score: float) -> str:
    if score >= 0.90:
        return "anomaly: high-confidence threat signal"
    if score >= 0.75:
        return "anomaly: suspicious behavior detected"
    return "anomaly: unusual activity pattern"


@app.route("/logs")
def logs():
    """Logs endpoint - returns firewall CSV logs + audit logs (DB)"""
    try:
        from backend.database.models import AuditLog
        from backend.database.db import db

        # Get organization_id from JWT if present, otherwise default to 1
        organization_id = 1
        try:
            from flask_jwt_extended import verify_jwt_in_request, get_jwt
            verify_jwt_in_request(optional=True)
            claims = get_jwt()
            if claims:
                organization_id = claims.get("organization_id", 1)
        except Exception:
            pass

        # Get recent audit logs
        recent_audit_logs = AuditLog.query.filter_by(
            organization_id=organization_id
        ).order_by(AuditLog.created_at.desc()).limit(100).all()

        recent_ids = {log.audit_id for log in recent_audit_logs}

        # Also fetch any audit logs that have anomaly detections but are older
        # than the last 100 — they must always be visible in the security log.
        older_flagged_logs = []
        try:
            from backend.database.models import AnomalyScore
            flagged_audit_ids = [
                r.audit_id for r in
                AnomalyScore.query.filter(
                    AnomalyScore.is_anomaly == True,
                    AnomalyScore.organization_id == organization_id,
                ).with_entities(AnomalyScore.audit_id).all()
                if r.audit_id not in recent_ids
            ]
            if flagged_audit_ids:
                older_flagged_logs = AuditLog.query.filter(
                    AuditLog.audit_id.in_(flagged_audit_ids)
                ).all()
        except Exception as _e:
            print(f"[/logs] AnomalyScore query skipped: {_e}")

        audit_logs = recent_audit_logs + older_flagged_logs

        # Get firewall logs first to build the base list
        raw_firewall_logs = get_logs()
        
        # Security action mappings for proper log categorization
        BLOCK_ACTIONS = {
            'canary_token_triggered', 'unauthorized_access', 'policy_violation',
            'llm_judge_block', 'firewall_injection_block', 'firewall_canary_block',
            'pii_data_leak', 'anomaly_score_block'
        }
        REASON_MAP = {
            'canary_token_triggered': 'Insider Threat — Canary Token',
            'llm_judge_block': 'LLM Judge — Malicious Chunk Detected',
            'firewall_injection_block': 'Firewall — Prompt Injection',
            'firewall_canary_block': 'Canary Detection',
            'pii_data_leak': 'Data Leak — PII Redacted in Response',
            'unauthorized_access': 'Unauthorized Access',
            'policy_violation': 'Policy Violation',
            'encrypted_query': 'Encrypted RAG Query',
            'rag_query': 'RAG Query',
        }
        STOPPED_BY_MAP = {
            'llm_judge_block': 'LLM Judge (Groq)',
            'firewall_injection_block': 'Regex + ML Firewall',
            'firewall_canary_block': 'Canary Detection',
            'pii_data_leak': 'PII Redaction Engine',
            'canary_token_triggered': 'Canary Triggers',
            'encrypted_query': 'Encrypted Pipeline',
            'rag_query': 'RAG Pipeline',
        }

        # Indexing for deduplication (Key: timestamp to-the-second + query snippet)
        def get_log_key(log_dict):
            # Firewall timestamps: 2026-04-13 17:43:20 (raw) or iso format
            raw_ts = log_dict.get('timestamp', '')
            ts = raw_ts[:19].replace('T', ' ') # normalize to YYYY-MM-DD HH:MM:SS
            q = (log_dict.get('query') or '')[:50].strip().lower()
            return f"{ts}_{q}"

        indexed_logs = {}
        for log in raw_firewall_logs:
            log['type'] = 'firewall'
            log['anomaly_score'] = None
            indexed_logs[get_log_key(log)] = log

        # 1. Process Audit Logs and overwrite/merge with Firewall logs
        audit_ids = [log.audit_id for log in audit_logs]
        score_map = {}
        try:
            if audit_ids:
                from backend.database.models import AnomalyScore as _AS
                scores = _AS.query.filter(_AS.audit_id.in_(audit_ids)).all()
                score_map = {s.audit_id: s for s in scores}
        except Exception as _e:
            print(f"[/logs] score_map query skipped: {_e}")

        for log in audit_logs:
            # Skip system-internal anomaly bookkeeping events — they are audit
            # trail entries, not external threats, and should not appear as
            # "stopped" rows in the security log.
            if log.action == 'anomaly_detected':
                continue

            try:
                username = log.user.username if (log.user and hasattr(log.user, 'username')) else 'system'
            except Exception:
                username = 'system'

            meta = log.meta_data or {}
            # Use query from meta or action name
            query_text = meta.get('query') or meta.get('reason') or log.action

            # Create a rich audit entry
            entry = {
                'id': log.audit_id,
                'timestamp': log.created_at.isoformat() + ('Z' if not log.created_at.tzinfo else ''),
                'query': query_text,
                'decision': meta.get('decision') or ('BLOCK' if log.action in BLOCK_ACTIONS else 'ALLOW'),
                'reason': meta.get('reason') or REASON_MAP.get(log.action, log.target_type or log.action),
                'stopped_by': meta.get('stopped_by') or STOPPED_BY_MAP.get(log.action, username),
                'action': log.action,
                'metadata': meta,
                'type': 'audit',
                'anomaly_score': None
            }

            # Enrich with Anomaly Score — only for genuinely anomalous events,
            # not for system-generated scoring artifacts (score=0.0 normal activity).
            s = score_map.get(log.audit_id)
            if s and s.is_anomaly and s.anomaly_score > 0.0:
                entry['anomaly_score'] = round(s.anomaly_score, 3)
                entry['anomaly_type']  = s.anomaly_type
                entry['decision']      = 'BLOCK'
                entry['reason']        = _anomaly_reason(s.anomaly_score)
                entry['stopped_by']    = 'Anomaly Detection (ML)'
                entry['is_anomaly']    = True

            # Deduplicate: Audit entry takes priority over firewall entry
            key = get_log_key(entry)
            indexed_logs[key] = entry

        # Sort combined logs by timestamp desc
        combined_logs = list(indexed_logs.values())
        combined_logs.sort(key=lambda x: x['timestamp'], reverse=True)

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
    import os
    # download_all only on the first process start, not on every reloader cycle
    if os.environ.get("WERKZEUG_RUN_MAIN") != "true":
        from backend.scripts.download_models import download_all
        download_all()
    start_log_poller()
    app.run(host="0.0.0.0", port=5200, debug=True, use_reloader=True)
