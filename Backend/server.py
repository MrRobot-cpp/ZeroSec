"""
ZeroSec Firewall — Flask SSE Log Streamer (fixed)
 - Immediate broadcast when write_log is called
 - SSE endpoint uses heartbeats and disables buffering to avoid client-side stalls
 - CSV poller kept (for external writers), but it's not required for /query -> immediate broadcast
"""

from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from pathlib import Path
import csv
import json
import time
import datetime
import threading
from queue import Queue, Empty
import os

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
    """Normalize CSV / log row into consistent JSON payload."""
    return {
        "timestamp": row.get("timestamp", datetime.datetime.utcnow().isoformat() + "Z"),
        "query": row.get("query", "-"),
        # keep score as float 0.0/1.0
        "score": float(row.get("score", 0.0)),
        "decision": (row.get("decision") or "ALLOW").upper(),
        "reason": row.get("reason", "") or "",
        "stopped_by": row.get("stopped_by") or "-",
    }


def broadcast(entry):
    """Push a normalized message to SSE queue for immediate delivery to all connected clients."""
    # Ensure it's JSON string
    if not isinstance(entry, str):
        payload = json.dumps(entry)
    else:
        payload = entry
    sse_queue.put(payload)


def sse_stream():
    """
    Continuously yield SSE messages to connected clients.

    - Waits for new messages on the queue and yields immediately.
    - Sends a lightweight heartbeat comment every 15s to keep connection alive
      (some proxies/nginx close idle connections).
    """
    heartbeat_interval = 15.0
    last_heartbeat = time.time()
    while True:
        try:
            # wait up to heartbeat_interval for a real message
            data = sse_queue.get(timeout=heartbeat_interval)
            # SSE data frame
            yield f"data: {data}\n\n"
            last_heartbeat = time.time()
        except Empty:
            # If no messages, send a comment heartbeat to keep connection alive
            yield f": heartbeat\n\n"
            last_heartbeat = time.time()


def write_log(entry):
    """
    Append a log entry to CSV and broadcast it immediately.
    entry must already contain timestamp, query, score, decision, reason, stopped_by
    """
    # ensure folder exists
    LOG_DIR.mkdir(exist_ok=True)
    # write CSV row (append + flush + fsync for immediate visibility)
    with LOG_CSV.open("a", newline="", encoding="utf-8") as f:
        fieldnames = ["timestamp", "query", "score", "decision", "reason", "stopped_by"]
        writer = csv.DictWriter(f, fieldnames=fieldnames, quotechar='"', quoting=csv.QUOTE_MINIMAL)
        writer.writerow(entry)
        f.flush()
        try:
            os.fsync(f.fileno())
        except Exception:
            # fsync may fail on some platforms; ignore but keep best-effort
            pass

    # Broadcast normalized entry to SSE clients (immediate real-time)
    broadcast(normalize(entry))


# ======================================================
# BACKGROUND CSV POLLER (kept for external writers)
# ======================================================
def csv_poller():
    """
    Poll the CSV file for new rows and broadcast them.

    This helps if an external process writes to the CSV file directly.
    Polling interval is short but adjustable.
    """
    print("[CSV POLLER] Watching pytector_logs/detections.csv every 2s")
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
        time.sleep(2)


# ======================================================
# FLASK APP
# ======================================================
app = Flask("zerosec_firewall_server")
CORS(app, resources={r"/*": {"origins": "*"}})


@app.route("/query", methods=["POST"])
def query_route():
    """Handle new RAG queries and immediately log + broadcast results."""
    data = request.get_json(force=True)
    query = data.get("question", "")

    # call rag pipeline
    result = query_rag(query) or {}

    # normalize result fields
    decision = (result.get("decision") or "ALLOW").upper()
    score = 1.0 if decision != "ALLOW" else 0.0
    reason = result.get("reason") or ""
    stopped_by = result.get("stopped_by") or "-"

    entry = {
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
        "query": query,
        "score": score,
        "decision": decision,
        "reason": reason,
        "stopped_by": stopped_by,
    }

    # write to CSV and broadcast immediately
    try:
        write_log(entry)
    except Exception as e:
        print("[ERROR] write_log failed:", e)

    # return original rag result to caller
    return jsonify(result)


@app.route("/logs")
def get_logs():
    """Return all stored logs (most recent last)."""
    logs = []
    if LOG_CSV.exists():
        with LOG_CSV.open("r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                logs.append(normalize(row))
    return jsonify(logs)


@app.route("/stream")
def stream():
    """
    SSE endpoint.

    Important headers:
    - Cache-Control: no-cache
    - X-Accel-Buffering: no  (recommended when behind nginx)
    """
    headers = {
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
        "Content-Type": "text/event-stream",
        "Transfer-Encoding": "chunked",
    }
    # Flask's Response accepts a generator and headers
    return Response(sse_stream(), headers=headers)


# ======================================================
# RUN
# ======================================================
if __name__ == "__main__":
    initialize_logs()
    # Start poller (kept for external processes writing CSV)
    threading.Thread(target=csv_poller, daemon=True).start()
    print("✅ ZeroSec Firewall Server running on http://localhost:5200")
    app.run(host="0.0.0.0", port=5200, debug=False, use_reloader=False)
