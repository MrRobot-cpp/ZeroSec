from pathlib import Path
import csv, json, time, datetime, threading
from queue import Queue, Empty

LOG_DIR = Path("logs")
LOG_FILE = LOG_DIR / "detections.csv"
queue = Queue()

def init_logs():
    LOG_DIR.mkdir(exist_ok=True)
    if not LOG_FILE.exists():
        with LOG_FILE.open("w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["timestamp", "query", "decision", "reason", "stopped_by"])

def log_decision(query, result):
    entry = {
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
        "query": query,
        "decision": result.get("decision", "ALLOW"),
        "reason": result.get("reason", ""),
        "stopped_by": result.get("stopped_by", "-"),
    }

    with LOG_FILE.open("a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=entry.keys())
        writer.writerow(entry)

    queue.put(json.dumps(entry))

def stream_logs():
    while True:
        try:
            data = queue.get(timeout=15)
            yield f"data: {data}\n\n"
        except Empty:
            yield ": heartbeat\n\n"

def get_logs():
    if not LOG_FILE.exists():
        return []
    with LOG_FILE.open("r", encoding="utf-8") as f:
        return list(csv.DictReader(f))

def start_log_poller():
    init_logs()
