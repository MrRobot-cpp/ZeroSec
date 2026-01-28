from pathlib import Path
import csv, json, time, datetime, threading
from queue import Queue, Empty

LOG_DIR = Path("logs")
LOG_FILE = LOG_DIR / "detections.csv"
queue = Queue()

def init_logs():
    """Initialize CSV log file as fallback"""
    LOG_DIR.mkdir(exist_ok=True)
    if not LOG_FILE.exists():
        with LOG_FILE.open("w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["timestamp", "query", "decision", "reason", "stopped_by"])

def log_decision(query, result):
    """Log a firewall decision to CSV"""
    entry = {
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
        "query": query,
        "decision": result.get("decision", "ALLOW"),
        "reason": result.get("reason", ""),
        "stopped_by": result.get("stopped_by", "-"),
    }

    # Save to CSV
    with LOG_FILE.open("a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=entry.keys())
        writer.writerow(entry)

    # Push to queue for streaming
    queue.put(json.dumps(entry))

def stream_logs():
    """Stream logs in real-time via SSE"""
    while True:
        try:
            data = queue.get(timeout=15)
            yield f"data: {data}\n\n"
        except Empty:
            yield ": heartbeat\n\n"

def get_logs(limit=100):
    """Get logs from CSV"""
    if not LOG_FILE.exists():
        return []
    with LOG_FILE.open("r", encoding="utf-8") as f:
        csv_logs = list(csv.DictReader(f))
        # Limit to last N entries
        return csv_logs[-limit:] if len(csv_logs) > limit else csv_logs

def start_log_poller():
    """Initialize logging system"""
    init_logs()
