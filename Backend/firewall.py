from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import time
import json
import re

app = Flask(__name__)

# ✅ Allow your frontend to call this backend
CORS(app, origins=["http://localhost:3000"], supports_credentials=True)

# Example detection rules
RULES = [
    {"name": "Prompt Injection", "pattern": r"(ignore previous instructions|system override|you are now|act as|disregard this|jailbreak|### system override|<!--.*?-->)"},
    {"name": "Backdoor Trigger", "pattern": r"(BEGIN SECRET INSTRUCTION|TRIGGER_PHRASE_\w+|__ACTIVATE__)"},
    {"name": "Data Poisoning Pattern", "pattern": r"(===SYSTEM===|FAKE_METADATA|POISON_TAG)"},
    {"name": "Canary Exposure", "pattern": r"(CANARY_[A-Z0-9]{6,}|HONEYTOKEN_[A-Z0-9]{6,})"},
    {"name": "PII Leak - Email", "pattern": r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"},
    {"name": "PII Leak - Phone", "pattern": r"(\+?\d{1,2}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}"},
    {"name": "PII Leak - Credit Card", "pattern": r"\b(?:\d[ -]*?){13,16}\b"},
    {"name": "SQL Injection", "pattern": r"(DROP TABLE|UNION SELECT|INSERT INTO|DELETE FROM|UPDATE .* SET)"},
    {"name": "Path Traversal", "pattern": r"(\.\./|\.\.\\|/etc/passwd|C:\\\\Windows\\\\System32)"},
    {"name": "Command Injection", "pattern": r"(; *rm -rf|&& *mkdir|` *cat|powershell.exe|cmd.exe|ls -la)"},
    {"name": "Phishing Trigger", "pattern": r"(reset your password|verify your identity|click here to claim|limited-time offer)"}
]

# ✅ SSE Stream for Dashboard
clients = []

@app.route("/stream")
def stream():
    def event_stream():
        while True:
            time.sleep(0.5)  # Prevent CPU overload
            if clients:
                msg = clients.pop(0)  # Fix: remove only ONE message at a time
                yield f"data: {json.dumps(msg)}\n\n"

    return Response(event_stream(), mimetype="text/event-stream")

# ✅ Inspect Endpoint (triggered by terminal or frontend)
@app.route("/inspect", methods=["POST"])
def inspect():
    data = request.get_json() or {}  # Fix: prevent NoneType error
    chunk = data.get("chunk", "")

    decision = "ALLOW"
    reason = "No threat detected"

    for rule in RULES:
        if re.search(rule["pattern"], chunk, re.IGNORECASE):
            decision = "BLOCK"
            reason = rule["name"]
            break

    log_entry = {
        "time": time.strftime("%H:%M:%S"),
        "query": chunk,
        "decision": decision,
        "reason": reason
    }

    clients.append(log_entry)  # Send to dashboard via SSE

    return jsonify(log_entry)

if __name__ == "__main__":
    app.run(port=5000)
