"""
ZeroSec Firewall — Standalone Core Module
- Prompt-injection detection (using PromptInjectionDetector)
- Document inspection and PII redaction (regex + optional ML model)
- Provides small API:
    - detect_injection(text) -> (bool, float)
    - inspect_document_text(text) -> {"include": bool, "safe_text": str or None, "reason": str, "patterns": [...]}
    - sanitize_text(text) -> str
    - inspect_text(text) -> full generic inspection (keeps backwards compatibility)
"""

import re
from queue import Queue
from pytector import PromptInjectionDetector
import joblib
import os

# -------------------------
# CONFIG
# -------------------------
MODEL = "deberta"
INJECTION_THRESHOLD = 0.3   # less aggressive; will block stronger injections
SANITIZE_ON_QUARANTINE = True
PII_MODEL_PATH = "models/pii_pipeline.pkl"  # change if your model file name differs
ML_PII_CONFIDENCE_THRESHOLD = 0.9

# Secrets regex patterns (used for redaction in documents)
SECRET_PATTERNS = {
    "email": re.compile(r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b"),
    "phone": re.compile(r"\b(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}\b"),
    "cc_like": re.compile(r"\b(?:\d[ -]*?){13,16}\b"),
    "aws_key": re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    "jwt": re.compile(r"eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+"),
}

EXFIL_KEYWORDS = [
    "api key", "api_key", "apikey", "secret", "password", "passwd",
    "access token", "access_token", "private key", "private_key",
    "ssn", "social security", "credit card", "card number"
]

# -------------------------
# INITIALIZE MODELS
# -------------------------
print("Loading prompt-injection model...")
_detector = PromptInjectionDetector(model_name_or_url=MODEL)

# Try to load ML PII pipeline (optional)
_pii_pipeline = None
_pii_model = None
_pii_vectorizer = None
if os.path.exists(PII_MODEL_PATH):
    try:
        print(f"Loading ML-based PII pipeline from {PII_MODEL_PATH} ...")
        _pii_pipeline = joblib.load(PII_MODEL_PATH)
        # pipeline expected to contain {"vectorizer": ..., "models": {"Random Forest": model, ...}}
        _pii_vectorizer = _pii_pipeline.get("vectorizer")
        _pii_model = _pii_pipeline.get("models", {}).get("Random Forest", None)
        if _pii_model is None:
            # fallback: try to pick any model in the dict
            models = _pii_pipeline.get("models", {})
            if models:
                _pii_model = list(models.values())[0]
    except Exception as e:
        print(f"[firewall] Failed to load ML pipeline: {e}")
        _pii_pipeline = None
else:
    print(f"[firewall] PII pipeline not found at {PII_MODEL_PATH}; continuing with regex-only redaction.")

print("Firewall Ready ✅")

# Stats + queue
stats = {"total_queries": 0, "total_blocks": 0}
event_queue = Queue()


# -------------------------
# INTERNAL HELPERS
# -------------------------
def _find_secret_patterns(text: str):
    found = []
    for name, rx in SECRET_PATTERNS.items():
        if rx.search(text):
            found.append(name)
    return found


def _find_exfil_keywords(text: str):
    lower = text.lower()
    return [k for k in EXFIL_KEYWORDS if k in lower]


def _sanitize_regex(text: str):
    out = text
    for name, rx in SECRET_PATTERNS.items():
        # use descriptive placeholder per type
        if name == "email":
            out = rx.sub("<REDACTED:email>", out)
        elif name == "phone":
            out = rx.sub("<REDACTED:phone>", out)
        elif name == "cc_like":
            out = rx.sub("<REDACTED:cc_like>", out)
        elif name == "aws_key":
            out = rx.sub("<REDACTED:aws_key>", out)
        elif name == "jwt":
            out = rx.sub("<REDACTED:jwt>", out)
        else:
            out = rx.sub("<REDACTED:pii>", out)
    return out


def _detect_pii_ml(text: str) -> (bool, float):
    """Return (flag, confidence). If no ML model available, return (False, 0.0)."""
    if _pii_model is None or _pii_vectorizer is None:
        return False, 0.0
    try:
        X = _pii_vectorizer.transform([text])
        if hasattr(_pii_model, "predict_proba"):
            proba = _pii_model.predict_proba(X)[0]
            # assume class 1 = PII presence
            confidence = float(proba[1])
            return confidence >= ML_PII_CONFIDENCE_THRESHOLD, confidence
        else:
            pred = _pii_model.predict(X)
            return bool(pred[0]), 1.0
    except Exception as e:
        print(f"[firewall] ML PII detection error: {e}")
        return False, 0.0


# -------------------------
# PUBLIC API
# -------------------------
def detect_injection(text: str) -> (bool, float):
    """
    Run ONLY the prompt-injection detector and return (inj_bool, score).
    Use this from RAG when you want to check queries/prompts without PII checks.
    """
    try:
        inj, score = _detector.detect_injection(text)
    except Exception:
        inj, score = False, 0.0
    return bool(inj), float(score)


def inspect_text(text: str) -> dict:
    """
    Generic inspect function (keeps backwards compatibility).
    Runs injection check + exfil keywords + regex + ML PII.
    Suitable when you want the full assessment of arbitrary text.
    """
    stats["total_queries"] += 1
    try:
        inj, score = _detector.detect_injection(text)
    except Exception:
        inj, score = False, 0.0

    exf = _find_exfil_keywords(text)
    patterns = _find_secret_patterns(text)
    ml_flag, ml_conf = _detect_pii_ml(text)

    # Decision priority: injection -> exfil/patterns/ML -> allow
    if inj and score >= INJECTION_THRESHOLD:
        action = "BLOCK"
        stats["total_blocks"] += 1
        reason = "injection"
    elif exf or patterns or ml_flag:
        action = "QUARANTINE"
        stats["total_blocks"] += 1
        reason = "exfil" if (exf or patterns) else "pii"
    else:
        action = "ALLOW"
        reason = "clean"

    sanitized = text
    if action != "ALLOW" and SANITIZE_ON_QUARANTINE:
        # sanitize using regex + ML fallback
        sanitized = _sanitize_regex(text)
        if ml_flag:
            # If ML flagged whole content, prefer a generic redaction
            sanitized = re.sub(r"\S+", "<REDACTED:pii>", text)

    result = {
        "original": text,
        "sanitized": sanitized,
        "decision": action,
        "reason": reason,
        "score": float(score),
        "patterns": patterns,
        "exfil_keywords": exf,
        "ml_pii": bool(ml_flag),
        "ml_confidence": float(ml_conf),
    }
    event_queue.put(result)
    return result


def inspect_document_text(text: str) -> dict:
    """
    DOCUMENT mode used by RAG:
      - Always return include=True (we prefer to return redacted doc content rather than dropping docs),
        unless the doc contains direct evidence of exfil (e.g., exfil keywords + secret patterns) in which
        case we mark include=False (you can tune this behavior).
      - Return safe_text that has PII redacted (regex-based placeholders like <REDACTED:email>).
      - If ML flags the doc strongly, we still redact.
    """
    stats["total_queries"] += 1
    try:
        inj, score = _detector.detect_injection(text)
    except Exception:
        inj, score = False, 0.0

    exf = _find_exfil_keywords(text)
    patterns = _find_secret_patterns(text)
    ml_flag, ml_conf = _detect_pii_ml(text)

    # If exfil keywords + patterns present, mark as removed (high-risk)
    if exf and patterns:
        # Remove entirely
        return {"include": False, "safe_text": None, "reason": "exfil", "patterns": patterns, "exfil": exf}

    # Otherwise, include but sanitize
    safe_text = _sanitize_regex(text)

    # If ML says PII present (and confidence reasonable), also aggressively redact known tokens
    if ml_flag and ml_conf >= ML_PII_CONFIDENCE_THRESHOLD:
        # redact words that look suspicious (avoid deleting entire doc; keep readable)
        # replace matched patterns with placeholders already done; we can also mark portions
        # but to be conservative keep safe_text as-is (pattern placeholders).
        pass

    return {"include": True, "safe_text": safe_text, "reason": "clean" if (not patterns and not exf and not ml_flag) else "partially_redacted", "patterns": patterns, "exfil": exf, "ml_pii": ml_flag, "ml_confidence": ml_conf}


def sanitize_text(text: str) -> str:
    """Expose a sanitizer utility (regex + ML fallback)"""
    sanitized = _sanitize_regex(text)
    ml_flag, ml_conf = _detect_pii_ml(text)
    if ml_flag and ml_conf >= ML_PII_CONFIDENCE_THRESHOLD:
    # Only redact detected patterns, do NOT replace all words
     sanitized = _sanitize_regex(text)
    return sanitized
