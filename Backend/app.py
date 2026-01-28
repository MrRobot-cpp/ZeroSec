from flask import Flask, request, jsonify, Response
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

@app.route("/query", methods=["POST"])
def query_route():
    data = request.get_json(force=True)
    question = data.get("question", "")

    result = query_rag(question)
    log_decision(question, result)

    return jsonify(result)

@app.route("/logs")
def logs():
    """Legacy logs endpoint - returns both firewall logs and audit logs"""
    try:
        from backend.database.models import AuditLog
        from backend.database.db import db

        # Get audit logs
        audit_logs = AuditLog.query.order_by(AuditLog.created_at.desc()).limit(100).all()

        # Combine with firewall logs
        combined_logs = get_logs()

        # Add audit logs to the response
        for log in audit_logs:
            combined_logs.append({
                'id': log.audit_id,
                'time': log.created_at.isoformat(),
                'query': log.action,
                'decision': 'ALLOW',
                'reason': log.target_type or '',
                'stopped_by': log.user.username if log.user else 'system',
                'action': log.action,
                'metadata': log.meta_data,
                'type': 'audit'
            })

        return jsonify(combined_logs)
    except Exception as e:
        # Fallback to original firewall logs only
        return jsonify(get_logs())

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

        # Auto-refresh RAG retriever
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
