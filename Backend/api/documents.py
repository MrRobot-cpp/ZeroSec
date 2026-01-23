import json
import re
from pathlib import Path
from datetime import datetime
from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename
from backend.services.rag_service import refresh_retriever

documents_bp = Blueprint('documents', __name__)

# Path configuration
BASE_DIR = Path(__file__).resolve().parents[1]
DOCS_PATH = BASE_DIR / "data" / "docs"
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

@documents_bp.route('/documents', methods=['GET'])
def get_documents():
    """Get all documents with metadata"""
    try:
        metadata = load_metadata()

        # Scan actual files in directory
        documents = []
        for file_path in DOCS_PATH.glob('*.*'):
            if file_path.is_file():
                filename = file_path.name
                file_meta = metadata.get(filename, {})

                # Get file stats
                stats = file_path.stat()

                documents.append({
                    'id': filename,
                    'name': filename,
                    'sensitivity': file_meta.get('sensitivity', 'Unknown'),
                    'status': file_meta.get('status', 'Uploaded'),
                    'acl_tags': file_meta.get('acl_tags', []),
                    'issues': file_meta.get('issues', []),
                    'size': stats.st_size,
                    'uploaded_at': file_meta.get('uploaded_at', datetime.fromtimestamp(stats.st_mtime).isoformat())
                })

        return jsonify({'documents': documents}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@documents_bp.route('/documents/upload', methods=['POST'])
def upload_document():
    """Upload a new document"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400

        file = request.files['file']

        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        # Secure the filename
        filename = secure_filename(file.filename)
        file_path = DOCS_PATH / filename

        # Check if file already exists
        if file_path.exists():
            return jsonify({'error': 'File already exists'}), 409

        # Save the file in its original format (no conversion)
        file.save(str(file_path))

        # Extract text content for scanning only (don't save as .txt)
        try:
            text_content = extract_text_from_file(file_path)
        except Exception as e:
            # If extraction fails, try to read as text directly
            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    text_content = f.read()
            except:
                text_content = f"[Error processing file: {e}]"

        # Scan document for issues
        issues = scan_document(filename, text_content)

        # Determine sensitivity based on issues
        sensitivity = 'High' if any('PII' in issue for issue in issues) else 'Medium' if issues else 'Low'

        # Save metadata
        metadata = load_metadata()
        metadata[filename] = {
            'uploaded_at': datetime.now().isoformat(),
            'sensitivity': sensitivity,
            'status': 'Scanned',
            'acl_tags': ['public'] if sensitivity == 'Low' else ['restricted'],
            'issues': issues,
            'size': file_path.stat().st_size
        }
        save_metadata(metadata)

        # Auto-refresh vectorstore to include new document
        try:
            refresh_retriever()
        except Exception:
            pass  # Non-critical, will refresh on next query

        return jsonify({
            'message': 'File uploaded successfully',
            'document': {
                'name': filename,
                'sensitivity': sensitivity,
                'status': 'Scanned',
                'issues': issues,
                'acl_tags': metadata[filename]['acl_tags']
            }
        }), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@documents_bp.route('/documents/<filename>', methods=['GET'])
def get_document_details(filename):
    """Get detailed information about a specific document"""
    try:
        filename = secure_filename(filename)
        file_path = DOCS_PATH / filename

        if not file_path.exists():
            return jsonify({'error': 'File not found'}), 404

        # Load metadata
        metadata = load_metadata()
        file_meta = metadata.get(filename, {})

        # Get file stats
        stats = file_path.stat()

        # Extract content preview
        content_preview = ""
        try:
            text_content = extract_text_from_file(file_path)
            content_preview = text_content[:500] + "..." if len(text_content) > 500 else text_content
        except Exception:
            content_preview = "[Unable to extract content preview]"

        # Build document details
        document = {
            'id': filename,
            'name': filename,
            'sensitivity': file_meta.get('sensitivity', 'Unknown'),
            'status': file_meta.get('status', 'Uploaded'),
            'acl_tags': file_meta.get('acl_tags', []),
            'issues': file_meta.get('issues', []),
            'size': stats.st_size,
            'uploaded_at': file_meta.get('uploaded_at', datetime.fromtimestamp(stats.st_mtime).isoformat()),
            'content_preview': content_preview,
            'scan_results': {
                'pii_count': len([i for i in file_meta.get('issues', []) if 'PII' in i]),
                'injection_score': 0.0,
            },
            'abac_attributes': {
                'department': 'All',
                'clearance_level': 'Confidential' if file_meta.get('sensitivity') == 'High' else 'Public',
                'data_classification': file_meta.get('sensitivity', 'Unknown'),
                'retention_policy': 'Standard'
            },
            'activity_log': [
                {
                    'timestamp': file_meta.get('uploaded_at'),
                    'action': 'Document uploaded',
                    'user': 'System',
                    'details': 'Initial upload and security scan'
                },
                {
                    'timestamp': file_meta.get('uploaded_at'),
                    'action': 'Security scan completed',
                    'user': 'System',
                    'details': f"Found {len(file_meta.get('issues', []))} issues"
                }
            ],
            'access_count': file_meta.get('access_count', 0),
            'last_accessed': file_meta.get('last_accessed')
        }

        return jsonify({'document': document}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@documents_bp.route('/documents/<filename>', methods=['DELETE'])
def delete_document(filename):
    """Delete a document"""
    try:
        filename = secure_filename(filename)
        file_path = DOCS_PATH / filename

        if not file_path.exists():
            return jsonify({'error': 'File not found'}), 404

        # Delete the file
        file_path.unlink()

        # Update metadata
        metadata = load_metadata()
        if filename in metadata:
            del metadata[filename]
            save_metadata(metadata)

        # Auto-refresh vectorstore to remove deleted document
        try:
            refresh_retriever()
        except Exception:
            pass  # Non-critical, will refresh on next query

        return jsonify({'message': 'File deleted successfully'}), 200

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
