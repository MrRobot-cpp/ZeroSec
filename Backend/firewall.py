"""
ZeroSec Firewall — Standalone Core Module
Safe to import directly from RAG pipeline.
"""

import re
from pathlib import Path
from queue import Queue
from pytector import PromptInjectionDetector

# ======================================================
# CONFIG
# ======================================================
MODEL = "deberta"
THRESHOLD = 0.5
SANITIZE_ON_BLOCK = True

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

# ======================================================
# INITIALIZE DETECTOR
# ======================================================
print("Loading prompt-injection model...")
_detector = PromptInjectionDetector(model_name_or_url=MODEL)
print("Firewall Ready ✅")

# Stats + event queue (optional usage)
stats = {"total_queries": 0, "total_blocks": 0}
event_queue = Queue()

# ======================================================
# INTERNAL HELPERS
# ======================================================
def _find_exfil_keywords(text):
    return [k for k in EXFIL_KEYWORDS if k in text.lower()]

def _find_secret_patterns(text):
    return [name for name, rx in SECRET_PATTERNS.items() if rx.search(text)]

def _sanitize(text):
    out = text
    for name, rx in SECRET_PATTERNS.items():
        out = rx.sub(f"<REDACTED:{name}>", out)
    return out

# ======================================================
# PUBLIC API — MAIN INSPECTION LOGIC
# ======================================================
def inspect_text(text: str) -> dict:
    """Check text for injection / exfil / secrets (used for prompts + outputs)."""
    stats["total_queries"] += 1

    try:
        inj, score = _detector.detect_injection(text)
    except:
        inj, score = False, 0.0

    exf = _find_exfil_keywords(text)
    pat = _find_secret_patterns(text)

    if inj and score >= THRESHOLD:
        action = "BLOCK"
        stats["total_blocks"] += 1
    elif exf or pat:
        action = "QUARANTINE"
        stats["total_blocks"] += 1
    else:
        action = "ALLOW"

    sanitized = _sanitize(text) if SANITIZE_ON_BLOCK and action != "ALLOW" else text

    result = {
        "original": text,
        "sanitized": sanitized,
        "decision": action,
        "reason": "injection" if inj else ("exfil" if exf or pat else "clean"),
        "score": float(score),
        "exfil_keywords": exf,
        "patterns": pat,
    }

    event_queue.put(result)  # optional for SSE
    return result

# ======================================================
# SPECIAL: DOCUMENT-SAFE MODE (OPTION A)
# ======================================================
def inspect_document_text(text: str) -> dict:
    """DOCUMENT mode: For RAG contexts."""
    result = inspect_text(text)

    if result["decision"] == "ALLOW":
        return {"include": True, "safe_text": text}

    return {
        "include": False,
        "safe_text": None,
        "reason": result["reason"],
        "patterns": result["patterns"],
        "exfil": result["exfil_keywords"]
    }

# ======================================================
# OPTIONAL UTILITY
# ======================================================
def sanitize_text(text: str) -> str:
    """Expose sanitizer for outside usage."""
    return _sanitize(text)
