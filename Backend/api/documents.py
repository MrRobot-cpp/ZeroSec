import json
import re
from pathlib import Path
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename

from backend.services.rag_service import refresh_retriever
from backend.database.repository import DocumentRepository
from backend.utils.rbac import require_permission, get_current_organization_id
from backend.utils.audit import log_audit

documents_bp = Blueprint('documents', __name__, url_prefix='/api')

# Path configuration
BASE_DIR = Path(__file__).resolve().parents[1]
DOCS_PATH = BASE_DIR / "data" / "docs"
HIGH_DOCS_PATH = BASE_DIR / "data" / "docs" / "high"
CONVERTED_PATH = BASE_DIR / "data" / "docs_converted"
METADATA_PATH = BASE_DIR / "data" / "docs_metadata.json"

# Accept all file types - no restrictions
ALLOWED_EXTENSIONS = None  # Accept everything

# Ensure directories exist
DOCS_PATH.mkdir(parents=True, exist_ok=True)
CONVERTED_PATH.mkdir(parents=True, exist_ok=True)

def allowed_file(filename):
    # Accept all files
    return True

def load_metadata():
    """Load document metadata from JSON file"""
    if METADATA_PATH.exists():
        with open(METADATA_PATH, 'r') as f:
            return json.load(f)
    return {}

def save_metadata(metadata):
    """Save document metadata to JSON file"""
    with open(METADATA_PATH, 'w') as f:
        json.dump(metadata, f, indent=2)

def extract_text_from_file(file_path):
    """Extract text content from various file formats"""
    file_extension = file_path.suffix.lower()

    try:
        # Plain text files
        if file_extension in ['.txt', '.md', '.log', '.csv', '.json', '.xml', '.html', '.htm']:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                return f.read()

        # PDF files
        elif file_extension == '.pdf':
            try:
                import PyPDF2
                text = []
                with open(file_path, 'rb') as f:
                    pdf_reader = PyPDF2.PdfReader(f)
                    for page in pdf_reader.pages:
                        text.append(page.extract_text())
                return '\n'.join(text)
            except ImportError:
                # Fallback: read as binary and decode
                with open(file_path, 'rb') as f:
                    return f.read().decode('utf-8', errors='ignore')

        # DOCX files
        elif file_extension == '.docx':
            try:
                import docx
                doc = docx.Document(file_path)
                return '\n'.join([paragraph.text for paragraph in doc.paragraphs])
            except ImportError:
                # Fallback: read as text
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    return f.read()

        # DOC files (older Word format)
        elif file_extension == '.doc':
            try:
                import pypandoc
                return pypandoc.convert_file(str(file_path), 'plain')
            except (ImportError, RuntimeError):
                # Fallback: read as text
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    return f.read()

        # Other files - try reading as text
        else:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                return f.read()

    except Exception as e:
        print(f"Error extracting text from {file_path}: {e}")
        # Last resort: read as binary and decode
        try:
            with open(file_path, 'rb') as f:
                return f.read().decode('utf-8', errors='ignore')
        except:
            return f"[Unable to extract text from {file_path.name}]"

def convert_to_txt(original_path, converted_path):
    """Convert any file to .txt format for RAG system"""
    text_content = extract_text_from_file(original_path)

    # Save as .txt file
    txt_filename = original_path.stem + '.txt'
    txt_path = converted_path / txt_filename

    with open(txt_path, 'w', encoding='utf-8') as f:
        f.write(text_content)

    return txt_path, text_content

def scan_document(filename, content):
    """Basic security scanning for documents"""
    issues = []

    # Check for PII patterns
    email_pattern = r'\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b'
    phone_pattern = r'\b\d{10,15}\b'

    if re.search(email_pattern, content, re.IGNORECASE):
        issues.append("PII: Email detected")
    if re.search(phone_pattern, content):
        issues.append("PII: Phone number detected")

    # Check for potential injection patterns
    injection_keywords = ['<script>', 'javascript:', 'onerror=', 'eval(', 'exec(']
    for keyword in injection_keywords:
        if keyword.lower() in content.lower():
            issues.append(f"Injection: {keyword} detected")

    return issues

def _ingest_high_sensitivity(file_path: Path, filename: str, doc_id: str, text_content: str) -> None:
    """
    Encrypted ingest pipeline for HIGH sensitivity documents.

    1. Move file to data/docs/high/
    2. Ingest text into SecureRAGProvider (Chroma chunk_ids + enc_store ciphertext)
    3. Overwrite original file with AES-256-GCM encrypted bytes
    """
    from flask import current_app
    from langchain_core.documents import Document as LCDocument
    from backend.api.secure_query import _get_secure_provider
    from backend.security.sag_crypto import encrypt, derive_key

    try:
        # 1. Move file to high/ directory
        import shutil
        HIGH_DOCS_PATH.mkdir(parents=True, exist_ok=True)
        high_file_path = HIGH_DOCS_PATH / filename
        shutil.move(str(file_path), str(high_file_path))

        # 2. Ingest into encrypted pipeline
        provider = _get_secure_provider()
        doc = LCDocument(
            page_content=text_content,
            metadata={
                'source':   str(high_file_path),
                'filename': filename,
                'file_type': file_path.suffix,
                'doc_id':   doc_id,
            }
        )
        provider.ingest_documents([doc])

        # 3. Overwrite file on disk with AES-256-GCM encrypted bytes
        secret_key = current_app.config.get('SECRET_KEY', '')
        key_version = current_app.config.get('SAG_KEY_VERSION', 1)
        key = derive_key(secret_key, doc_id, 'HIGH', key_version)
        raw_bytes = high_file_path.read_bytes()
        ciphertext, nonce, auth_tag = encrypt(raw_bytes, key)
        high_file_path.write_bytes(nonce + auth_tag + ciphertext)

        import logging
        logging.getLogger("zerosec.documents").info(
            "[HIGH ingest] %s ingested and encrypted on disk", filename
        )

    except Exception as exc:
        import logging
        logging.getLogger("zerosec.documents").error(
            "[HIGH ingest] failed for %s: %s", filename, exc
        )
        raise


@documents_bp.route('/documents', methods=['GET'])
@jwt_required()
@require_permission('read')
def get_documents():
    """Get all documents with metadata"""
    try:
        organization_id = get_current_organization_id()
        user_id = get_jwt_identity()

        # Get documents from database
        db_documents = DocumentRepository.get_all_documents(organization_id)

        documents = []
        for doc in db_documents:
            # Try to get file stats if file exists
            file_path = DOCS_PATH / doc.filename
            file_size = file_path.stat().st_size if file_path.exists() else 0

            documents.append({
                'id': doc.document_id,
                'name': doc.filename,
                'sensitivity': doc.sensitivity,
                'clearance_level': doc.clearance_level.name if doc.clearance_level else None,
                'size': file_size,
                'uploaded_at': doc.created_at.isoformat()
            })

        # Log audit event
        log_audit(
            organization_id=organization_id,
            user_id=user_id,
            action='documents_listed',
            target_type='Document'
        )

        return jsonify({'documents': documents}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@documents_bp.route('/documents/upload', methods=['POST'])
@jwt_required()
@require_permission('create')
def upload_document():
    """Upload a new document"""
    try:
        organization_id = get_current_organization_id()
        user_id = get_jwt_identity()

        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400

        file = request.files['file']

        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        # Secure the filename
        filename = secure_filename(file.filename)
        file_path = DOCS_PATH / filename

        # Check if document already exists in database
        existing_doc = DocumentRepository.get_document_by_filename(organization_id, filename)
        if existing_doc:
            return jsonify({'error': 'Document already exists'}), 409

        # Save the file
        file.save(str(file_path))

        # Extract text content for scanning
        try:
            text_content = extract_text_from_file(file_path)
        except Exception as e:
            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    text_content = f.read()
            except:
                text_content = f"[Error processing file: {e}]"

        # Scan document for issues
        issues = scan_document(filename, text_content)

        # Determine sensitivity
        provided_sensitivity = request.form.get('sensitivity', '').lower()
        if provided_sensitivity in ['high', 'medium', 'low']:
            sensitivity = provided_sensitivity.capitalize()
        else:
            sensitivity = 'High' if any('PII' in issue for issue in issues) else 'Medium' if issues else 'Low'

        # Create document in database
        document = DocumentRepository.create_document(
            organization_id=organization_id,
            filename=filename,
            storage_ref=str(file_path),
            sensitivity=sensitivity,
            user_id=user_id
        )

        # Log audit event
        log_audit(
            organization_id=organization_id,
            user_id=user_id,
            action='document_uploaded',
            target_type='Document',
            target_id=document.document_id,
            metadata={'filename': filename, 'sensitivity': sensitivity, 'issues_count': len(issues)}
        )

        # Route based on sensitivity
        if sensitivity == 'High':
            _ingest_high_sensitivity(file_path, filename, str(document.document_id), text_content)
        else:
            # Standard pipeline — refresh Chroma vectorstore
            try:
                refresh_retriever()
            except Exception:
                pass

        return jsonify({
            'message': 'File uploaded successfully',
            'document': {
                'id': document.document_id,
                'name': filename,
                'sensitivity': sensitivity,
                'issues_count': len(issues)
            }
        }), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@documents_bp.route('/documents/<int:document_id>', methods=['GET'])
@jwt_required()
@require_permission('read')
def get_document_details(document_id):
    """Get detailed information about a specific document"""
    try:
        organization_id = get_current_organization_id()
        user_id = get_jwt_identity()

        # Get document from database
        document = DocumentRepository.get_document_by_id(document_id)

        if not document or document.organization_id != organization_id:
            return jsonify({'error': 'Document not found'}), 404

        file_path = DOCS_PATH / document.filename

        # Extract content preview if file exists
        content_preview = ""
        file_size = 0
        if file_path.exists():
            file_size = file_path.stat().st_size
            try:
                text_content = extract_text_from_file(file_path)
                content_preview = text_content[:500] + "..." if len(text_content) > 500 else text_content
            except Exception:
                content_preview = "[Unable to extract content preview]"

        # Get activity log from audit
        from backend.utils.audit import get_document_activity
        activity_log = get_document_activity(document_id, limit=10)

        # Build document details
        doc_details = {
            'id': document.document_id,
            'name': document.filename,
            'sensitivity': document.sensitivity,
            'clearance_level': document.clearance_level.name if document.clearance_level else None,
            'size': file_size,
            'uploaded_at': document.created_at.isoformat(),
            'content_preview': content_preview,
            'activity_log': activity_log
        }

        # Log audit event
        log_audit(
            organization_id=organization_id,
            user_id=user_id,
            action='document_viewed',
            target_type='Document',
            target_id=document_id
        )

        return jsonify({'document': doc_details}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@documents_bp.route('/documents/<int:document_id>', methods=['DELETE'])
@jwt_required()
@require_permission('delete')
def delete_document(document_id):
    """Delete a document"""
    try:
        organization_id = get_current_organization_id()
        user_id = get_jwt_identity()

        # Get document from database
        document = DocumentRepository.get_document_by_id(document_id)

        if not document or document.organization_id != organization_id:
            return jsonify({'error': 'Document not found'}), 404

        filename = document.filename

        # Delete physical file — check both standard and high/ paths
        for candidate in [DOCS_PATH / filename, HIGH_DOCS_PATH / filename]:
            if candidate.exists():
                candidate.unlink()

        # If HIGH sensitivity, remove from encrypted pipeline
        if document.sensitivity == 'High':
            try:
                from backend.api.secure_query import _get_secure_provider
                _get_secure_provider().delete_documents([filename])
            except Exception as exc:
                import logging
                logging.getLogger("zerosec.documents").warning(
                    "[delete] encrypted pipeline cleanup failed for %s: %s", filename, exc
                )

        # Delete from database (cascades to uploads, canary tokens, etc.)
        DocumentRepository.delete_document(document_id)

        # Log audit event
        log_audit(
            organization_id=organization_id,
            user_id=user_id,
            action='document_deleted',
            target_type='Document',
            target_id=document_id,
            metadata={'filename': filename}
        )

        # Auto-refresh vectorstore
        try:
            refresh_retriever()
        except Exception:
            pass

        return jsonify({'message': 'Document deleted successfully'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@documents_bp.route('/documents/refresh', methods=['POST'])
def refresh_documents():
    """Force refresh the RAG retriever to pick up new documents"""
    try:
        refresh_retriever()
        return jsonify({'message': 'RAG retriever refreshed successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
