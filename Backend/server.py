"""
ZeroSec Firewall — Flask SSE Log Streamer (No Watchdog)
"""

from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from pathlib import Path
import csv
import json
import time
import datetime
import threading
from queue import Queue

from rag_pipeline import query_rag  # must return dict with {query, decision, reason, stopped_by}

# ======================================================
# CONFIG
# ======================================================
LOG_DIR = Path("pytector_logs")
LOG_CSV = LOG_DIR / "detections.csv"
sse_queue = Queue()


# ======================================================
# INIT
# ======================================================
def initialize_logs():
    LOG_DIR.mkdir(exist_ok=True)
    if not LOG_CSV.exists():
        with LOG_CSV.open("w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["timestamp", "query", "score", "decision", "reason", "stopped_by"])
        print("[INIT] Created pytector_logs/detections.csv")


# ======================================================
# UTIL
# ======================================================
def normalize(row):
    return {
        "timestamp": row.get("timestamp", datetime.datetime.utcnow().isoformat() + "Z"),
        "query": row.get("query", "-"),
        "score": float(row.get("score", 0.0)),
        "decision": row.get("decision", "ALLOW").upper(),
        "reason": row.get("reason", ""),
        "stopped_by": row.get("stopped_by", "-"),
    }


def broadcast(entry):
    """Push a message to all SSE clients."""
    sse_queue.put(json.dumps(entry))


def sse_stream():
    """Continuously yield messages to connected clients."""
    while True:
        data = sse_queue.get()  # waits until a new log arrives
        yield f"data: {data}\n\n"


def write_log(entry):
    """Append a log entry to CSV and broadcast it."""
    with LOG_CSV.open("a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["timestamp", "query", "score", "decision", "reason", "stopped_by"])
        writer.writerow(entry)
    broadcast(entry)


# ======================================================
# BACKGROUND CSV POLLER (checks every 5 seconds)
# ======================================================
def csv_poller():
    """Poll the CSV file for new rows and broadcast them."""
    print("[CSV POLLER] Watching pytector_logs/detections.csv every 5s")
    last_line_count = 0
    while True:
        try:
            if LOG_CSV.exists():
                with LOG_CSV.open("r", encoding="utf-8") as f:
                    rows = list(csv.DictReader(f))
                    if len(rows) > last_line_count:
                        new_rows = rows[last_line_count:]
                        for row in new_rows:
                            broadcast(normalize(row))
                        last_line_count = len(rows)
        except Exception as e:
            print("[ERROR] CSV poller failed:", e)
        time.sleep(5)


# ======================================================
# FLASK APP
# ======================================================
app = Flask("zerosec_firewall_server")
CORS(app, resources={r"/*": {"origins": "*"}})


@app.route("/query", methods=["POST"])
def query_route():
    """Handle new RAG queries."""
    data = request.get_json(force=True)
    query = data.get("question", "")

    result = query_rag(query)
    decision = result.get("decision", "ALLOW").upper()
    score = 1.0 if decision != "ALLOW" else 0.0

    entry = {
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
        "query": query,
        "score": score,
        "decision": decision,
        "reason": result.get("reason", ""),
        "stopped_by": result.get("stopped_by", "-"),
    }

    write_log(entry)
    return jsonify(result)


@app.route("/logs")
def get_logs():
    """Return all stored logs."""
    logs = []
    if LOG_CSV.exists():
        with LOG_CSV.open("r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            logs = [normalize(r) for r in reader]
    return jsonify(logs)


@app.route("/stream")
def stream():
    """Server-Sent Events endpoint."""
    return Response(sse_stream(), mimetype="text/event-stream")


# ======================================================
# RUN
# ======================================================
if __name__ == "__main__":
    initialize_logs()
    threading.Thread(target=csv_poller, daemon=True).start()
    print("✅ ZeroSec Firewall Server running on http://localhost:5200")
    app.run(host="0.0.0.0", port=5200, debug=False, use_reloader=False)
