# backend/api/query.py

from flask import Blueprint, request, jsonify
from backend.services.rag_service import query_rag

query_bp = Blueprint("query", __name__)

@query_bp.route("/query", methods=["POST"])
def query():
    data = request.get_json(force=True)
    question = data.get("question", "").strip()

    if not question:
        return jsonify({"error": "empty query"}), 400

    result = query_rag(question)
    return jsonify(result)
