from flask import Blueprint, request, send_file, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from backend.services.canary_service import watermark_txt, watermark_pdf, watermark_docx, OUTPUT_DIR
from backend.database.repository import CanaryTokenRepository
from backend.utils.audit import log_audit
import os

canary_bp = Blueprint("canary_bp", __name__)

ALLOWED_EXTENSIONS = {"pdf", "docx", "txt"}

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

@canary_bp.route("/canary/watermark", methods=["POST"])
def watermark():
    if "file" not in request.files:
        return jsonify({"error": "Missing file"}), 400
    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "Missing file"}), 400
    if not allowed_file(file.filename):
        return jsonify({"error": "Unsupported file type"}), 400
    filename = secure_filename(file.filename)
    ext = filename.rsplit(".", 1)[1].lower()
    temp_path = os.path.join(OUTPUT_DIR, "temp_" + filename)
    file.save(temp_path)
    try:
        if ext == "txt":
            meta = watermark_txt(temp_path)
        elif ext == "pdf":
            meta = watermark_pdf(temp_path)
        elif ext == "docx":
            meta = watermark_docx(temp_path)
        else:
            return jsonify({"error": "Unsupported file type"}), 400
        output_path = meta["output_path"]
        canary_id = meta["canary_id"]
        hash_val = meta.get("hash", "")
        response = send_file(
            output_path,
            as_attachment=True,
            download_name=filename.rsplit(".", 1)[0] + "_canary." + ext
        )
        # Set individual headers
        response.headers["X-Canary-ID"] = str(canary_id)
        response.headers["X-Output-Path"] = str(output_path)
        response.headers["X-Canary-Hash"] = str(hash_val)

        # Also return JSON metadata in a header for frontend fetch
        import json
        meta_json = json.dumps({
            "canary_id": str(canary_id),
            "hash": str(hash_val),
            "output_path": str(output_path),
            "filename": str(filename)
        })
        response.headers["X-Canary-Meta"] = meta_json
        return response
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


@canary_bp.route("/api/canary/tokens", methods=["GET"])
@jwt_required()
def get_canary_tokens():
    """Get all canary tokens for the user's organization"""
    from flask_jwt_extended import get_jwt
    claims = get_jwt()
    organization_id = claims.get('organization_id')

    try:
        from backend.database.models import CanaryToken
        tokens = CanaryToken.query.filter_by(
            organization_id=organization_id
        ).order_by(CanaryToken.canary_token_id.desc()).all()

        tokens_data = [{
            'canary_token_id': token.canary_token_id,
            'document_id': token.document_id,
            'organization_id': token.organization_id,
            'token_hash': token.token_hash,
            'is_triggered': token.is_triggered,
            'triggered_at': token.triggered_at.isoformat() if token.triggered_at else None
        } for token in tokens]

        return jsonify({'tokens': tokens_data}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@canary_bp.route("/api/canary/tokens/triggered", methods=["GET"])
@jwt_required()
def get_triggered_tokens():
    """Get all triggered canary tokens"""
    from flask_jwt_extended import get_jwt
    claims = get_jwt()
    organization_id = claims.get('organization_id')

    try:
        triggered_tokens = CanaryTokenRepository.get_triggered_tokens(organization_id)

        tokens_data = [{
            'canary_token_id': token.canary_token_id,
            'document_id': token.document_id,
            'token_hash': token.token_hash,
            'triggered_at': token.triggered_at.isoformat() if token.triggered_at else None
        } for token in triggered_tokens]

        return jsonify({'triggered_tokens': tokens_data}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@canary_bp.route("/api/canary/trigger/<token_hash>", methods=["POST"])
@jwt_required()
def trigger_token(token_hash):
    """Manually trigger a canary token (for testing or incident reporting)"""
    from flask_jwt_extended import get_jwt
    user_id = get_jwt_identity()
    claims = get_jwt()
    organization_id = claims.get('organization_id')

    try:
        canary = CanaryTokenRepository.trigger_canary_token(token_hash)

        if not canary:
            return jsonify({"error": "Canary token not found"}), 404

        # Log audit event
        log_audit(
            organization_id=organization_id,
            user_id=user_id,
            action='canary_token_triggered',
            target_type='CanaryToken',
            target_id=canary.canary_token_id,
            meta_data={
                'token_hash': token_hash,
                'triggered_manually': True
            }
        )

        return jsonify({
            'message': 'Canary token triggered successfully',
            'canary_token_id': canary.canary_token_id,
            'triggered_at': canary.triggered_at.isoformat() if canary.triggered_at else None
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
