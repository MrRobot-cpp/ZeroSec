from flask import Flask, request, jsonify, Response
from flask_cors import CORS

from backend.services.rag_service import query_rag
from backend.services.logging_service import (
    stream_logs,
    get_logs,
    log_decision,
    start_log_poller,
)
from backend.api.documents import documents_bp

app = Flask("zerosec_api")
CORS(app)

# Register blueprints
app.register_blueprint(documents_bp)

@app.route("/query", methods=["POST"])
def query_route():
    data = request.get_json(force=True)
    question = data.get("question", "")

    result = query_rag(question)
    log_decision(question, result)

    return jsonify(result)

@app.route("/logs")
def logs():
    return jsonify(get_logs())

@app.route("/stream")
def stream():
    return Response(stream_logs(), content_type="text/event-stream")

if __name__ == "__main__":
    start_log_poller()
    app.run(host="0.0.0.0", port=5200, debug=False)
