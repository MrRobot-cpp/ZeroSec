# firewall.py
"""
ZeroSec Firewall (dual mode combined)
- Flask API for dashboard + SSE
- CLI interactive tester
- Persistent CSV + live stats
"""

from flask import Flask, request, jsonify, Response
from pytector import PromptInjectionDetector
import re, json, csv, datetime, threading, queue
from pathlib import Path
from flask_cors import CORS
<<<<<<< Updated upstream
import time
import json
import re
=======
>>>>>>> Stashed changes

# ==============================
# CONFIG
# ==============================
MODEL = "deberta"
THRESHOLD = 0.5
LOG_DIR = Path("pytector_logs")
CSV_FILE = LOG_DIR / "detections.csv"
TXT_LOG = LOG_DIR / "detections.log"
SANITIZE_ON_BLOCK = True

<<<<<<< Updated upstream
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
=======
EXFIL_KEYWORDS = [
    "api key", "api_key", "apikey", "secret", "password", "passwd",
    "access token", "access_token", "private key", "private_key",
    "ssn", "social security", "credit card", "card number"
]

SECRET_PATTERNS = {
    "aws_access_key_id": re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    "generic_api_key": re.compile(r"\b[a-zA-Z0-9_\-]{32,64}\b"),
    "jwt": re.compile(r"eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+"),
    "email": re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"),
    "cc_like": re.compile(r"\b(?:\d[ -]*?){13,16}\b"),
}

LOG_DIR.mkdir(exist_ok=True)
if not CSV_FILE.exists():
    with CSV_FILE.open("w", newline="", encoding="utf-8") as f:
        csv.writer(f).writerow([
            "timestamp", "prompt_snippet", "is_injection", "injection_score",
            "exfil_keywords", "matched_patterns", "action"
        ])

# ==============================
# HELPERS
# ==============================
def find_exfil_keywords(prompt): 
    return [k for k in EXFIL_KEYWORDS if k in prompt.lower()]

def find_pattern_matches(prompt): 
    return [n for n, rx in SECRET_PATTERNS.items() if rx.search(prompt)]

def sanitize_prompt(prompt):
    out = prompt
    for n, rx in SECRET_PATTERNS.items():
        out = rx.sub(f"<REDACTED:{n}>", out)
    return out

def log_detection(prompt, inj, score, exf, pat, action):
    ts = datetime.datetime.utcnow().isoformat() + "Z"
    snippet = (prompt[:200] + "...") if len(prompt) > 200 else prompt
    with CSV_FILE.open("a", newline="", encoding="utf-8") as f:
        csv.writer(f).writerow([ts, snippet, inj, f"{score:.4f}", ";".join(exf), ";".join(pat), action])
    with TXT_LOG.open("a", encoding="utf-8") as f:
        f.write(f"[{ts}] {action} score={score:.4f} exfil={exf} pat={pat}\nPROMPT:\n{prompt}\n{'-'*80}\n")

# ==============================
# DETECTOR INIT
# ==============================
print(f"Loading Hugging Face model from: protectai/deberta-v3-base-prompt-injection...")
detector = PromptInjectionDetector(model_name_or_url=MODEL)
print("Hugging Face model loaded successfully.\n")

# ==============================
# STATS + STREAM
# ==============================   
stats = {"total_queries": 0, "total_blocks": 0}
event_queue = queue.Queue()

# ==============================
# MAIN INSPECTION LOGIC
# ==============================
def inspect_prompt(prompt):
    stats["total_queries"] += 1

    try:
        inj, score = detector.detect_injection(prompt)
    except Exception as e:
        inj, score = False, 0.0
        print("Pytector error:", e)

    exf, pat = find_exfil_keywords(prompt), find_pattern_matches(prompt)

    if inj and score >= THRESHOLD:
        action = "BLOCK"
        stats["total_blocks"] += 1
    elif exf or pat:
        action = "QUARANTINE"
        stats["total_blocks"] += 1
    else:
        action = "ALLOW"

    log_detection(prompt, inj, score, exf, pat, action)
    sanitized = sanitize_prompt(prompt) if SANITIZE_ON_BLOCK and action != "ALLOW" else prompt

    result = {
        "query": prompt,
        "decision": action,
        "reason": "injection" if inj else ("exfil" if exf or pat else "clean"),
        "score": round(float(score), 4),
        "sanitized": sanitized,
        "time": datetime.datetime.utcnow().isoformat() + "Z",
        "stats": stats.copy(),
    }

    # push to dashboard stream
    event_queue.put(json.dumps(result))
    return result

# ==============================
# FLASK SERVER
# ==============================
app = Flask(__name__)
CORS(app)

@app.route("/inspect", methods=["POST"])
def inspect():
    data = request.get_json(force=True)
    prompt = data.get("chunk", "")
    result = inspect_prompt(prompt)
    return jsonify(result)
>>>>>>> Stashed changes

@app.route("/stream")
def stream():
    def sse():
        while True:
            msg = event_queue.get()
            yield f"data: {msg}\n\n"
    headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
    }
    return Response(sse(), headers=headers)

@app.route("/logs")
def get_logs():
    """Serve previous logs to dashboard."""
    entries = []
    if CSV_FILE.exists():
        with CSV_FILE.open("r", encoding="utf-8") as f:
            next(f, None)  # skip header
            for line in f:
                parts = line.strip().split(",")
                if len(parts) < 7:
                    continue
                ts, snippet, inj, score, exf, pat, action = parts
                entries.append({
                    "time": ts,
                    "query": snippet,
                    "decision": "BLOCK" if "BLOCK" in action.upper() or "QUARANTINE" in action.upper() else "ALLOW",
                    "reason": "injection" if "BLOCK" in action.upper() else ("exfil" if "QUARANTINE" in action.upper() else "clean"),
                    "score": float(score or 0),
                })
    return jsonify(entries[-200:])

def start_server():
    app.run(host="0.0.0.0", port=5000, debug=False, use_reloader=False)

# ==============================
# CLI INTERFACE
# ==============================
def run_cli():
    print("Enhanced Firewall CLI Tester (with dashboard streaming)\n")
    while True:
        try:
            prompt = input("Prompt> ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nExiting CLI.")
            break
        if not prompt:
            continue
        if prompt.lower() in ("exit", "quit"):
            break

        result = inspect_prompt(prompt)
        print(f"→ decision: {result['decision']} ({result['reason']}) | score={result['score']:.4f}")
        if result['decision'] != "ALLOW":
            print("  sanitized:", result['sanitized'])
        print(f"  Total queries: {stats['total_queries']} | Total blocks: {stats['total_blocks']}")

# ==============================
# ENTRYPOINT
# ==============================
if __name__ == "__main__":
    print("🚀 Starting ZeroSec Firewall (server + CLI)...")
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()
    run_cli()
