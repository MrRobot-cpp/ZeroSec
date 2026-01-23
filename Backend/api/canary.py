from flask import Blueprint, request, send_file, jsonify
from werkzeug.utils import secure_filename
from backend.services.canary_service import watermark_txt, watermark_pdf, watermark_docx, OUTPUT_DIR
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
