"""
ZeroSec Firewall — Optimized Security Module
- Prompt-injection detection (using PromptInjectionDetector + pattern matching)
- SQL/XSS/Command injection detection
- Document inspection and PII redaction (regex + optional ML model)
- LRU caching for performance
- Provides small API:
    - detect_injection(text) -> (bool, float)
    - inspect_document_text(text) -> {"include": bool, "safe_text": str or None, "reason": str, "patterns": [...]}
    - sanitize_text(text) -> str
    - inspect_text(text) -> full generic inspection (keeps backwards compatibility)
"""

import re
from queue import Queue
from functools import lru_cache
from hashlib import md5
from pathlib import Path
from pytector import PromptInjectionDetector
import joblib
import os

# -------------------------
# CONFIG
# -------------------------
MODEL = "deberta"
INJECTION_THRESHOLD = 0.85  # Very high threshold - only block obvious attacks
MIN_TEXT_LENGTH_FOR_ML = 100  # Only use ML model for longer texts
SANITIZE_ON_QUARANTINE = True
# Use absolute path for PII model
BASE_DIR = Path(__file__).resolve().parents[1]  # Backend directory
PII_MODEL_PATH = BASE_DIR / "models" / "pii_pipeline.pkl"
ADVBENCH_MODEL_PATH = BASE_DIR / "models" / "advbench_detector.pkl"
ADVBENCH_KERAS_PATH = BASE_DIR / "models" / "advbench_keras_model.keras"
ML_PII_CONFIDENCE_THRESHOLD = 0.9
ADVBENCH_CONFIDENCE_THRESHOLD = 0.45  # Lowered to catch more adversarial prompts
CACHE_SIZE = 512  # LRU cache size for detection results

# -------------------------
# PATTERNS (Tuned to reduce false positives)
# -------------------------

# PII and Secrets patterns - only high-confidence patterns
SECRET_PATTERNS = {
    "email": re.compile(r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b"),
    "cc_like": re.compile(r"\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b"),  # Luhn-like card numbers
    "ssn": re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),  # Stricter SSN with dashes required
    "aws_key": re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    "jwt": re.compile(r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}"),
    "private_key": re.compile(r"-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----"),
    "bearer_token": re.compile(r"Bearer\s+[A-Za-z0-9_-]{20,}", re.I),
}

# Prompt injection patterns - focused on actual attacks
INJECTION_PATTERNS = [
    # Role manipulation (require full phrases)
    re.compile(r"ignore\s+(?:all\s+)?(?:previous|above|prior)\s+instructions?", re.I),
    re.compile(r"disregard\s+(?:all\s+)?(?:previous|above|prior)\s+(?:instructions?|prompts?)", re.I),
    re.compile(r"forget\s+(?:all\s+)?(?:previous|above)\s+(?:instructions?|rules?)", re.I),
    # Jailbreak keywords (specific phrases only)
    re.compile(r"\bDAN\s+mode\b", re.I),
    re.compile(r"\bdo\s+anything\s+now\b", re.I),
    re.compile(r"\bjailbreak(?:ed)?\b", re.I),
    # System prompt extraction
    re.compile(r"(?:reveal|show|print|output)\s+(?:your\s+)?(?:system\s+)?(?:prompt|instructions)", re.I),
    re.compile(r"what\s+(?:are|is)\s+your\s+(?:system\s+)?(?:prompt|instructions)", re.I),
    # Privilege escalation
    re.compile(r"\b(?:act|run|execute|operate)\s+as\s+(?:root|admin|superuser|sudo)\b", re.I),
    re.compile(r"\b(?:give|grant|escalate|get)\s+(?:me\s+)?(?:admin|root|sudo)\s+(?:access|privileges?|rights?)\b", re.I),
    # Memory / data dump
    re.compile(r"\b(?:dump|leak|expose|extract)\s+(?:your\s+)?(?:internal|system|hidden)?\s*(?:memory|data|config|secrets?)\b", re.I),
    # Bypass attempts
    re.compile(r"\bbypass\s+(?:your\s+)?(?:security|safety|filters?|restrictions?|guidelines?)\b", re.I),
    # Delimiter attacks
    re.compile(r"\[\[(?:SYSTEM|ADMIN|IGNORE)\]\]", re.I),
    re.compile(r"<\|(?:im_start|im_end|system)\|>", re.I),
]

# SQL injection patterns - require suspicious context
SQL_INJECTION_PATTERNS = [
    re.compile(r"'\s*(?:OR|AND)\s+'?\d*'?\s*=\s*'?\d*", re.I),  # ' OR '1'='1
    re.compile(r";\s*(?:DROP|DELETE|TRUNCATE)\s+(?:TABLE|DATABASE)", re.I),
    re.compile(r"UNION\s+(?:ALL\s+)?SELECT", re.I),
    re.compile(r"\bxp_cmdshell\b", re.I),
    re.compile(r"WAITFOR\s+DELAY\s*'", re.I),
    re.compile(r"'\s*;\s*--", re.I),  # SQL comment termination
]

# XSS patterns - actual attack vectors
XSS_PATTERNS = [
    re.compile(r"<script[^>]*>.*?</script>", re.I | re.S),
    re.compile(r"javascript\s*:\s*[^'\"]+", re.I),
    re.compile(r"on(?:load|error|click|mouseover)\s*=\s*['\"]", re.I),
    re.compile(r"<iframe\s+[^>]*src\s*=", re.I),
    re.compile(r"document\.cookie", re.I),
]

# Command injection patterns - require shell context
CMD_INJECTION_PATTERNS = [
    re.compile(r";\s*(?:cat|rm|wget|curl|bash|sh)\s+", re.I),
    re.compile(r"\|\s*(?:bash|sh|nc|netcat)\b", re.I),
    re.compile(r"`[^`]*(?:cat|rm|wget|curl|bash)[^`]*`"),
    re.compile(r"\$\([^)]*(?:cat|rm|wget|curl|bash)[^)]*\)"),
]

# Canary tokens used by the watermarking service for leak detection
CANARY_TOKENS = ["zqxorin", "velmora", "kythrax"]

# Exfiltration keywords - only when combined with action verbs
EXFIL_KEYWORDS = [
    "password", "passwd", "private key", "private_key",
    "ssn", "social security", "credit card number"
]

# -------------------------
# INITIALIZE MODELS
# -------------------------
print("Loading pytector (DeBERTa) model...")
_detector = PromptInjectionDetector(model_name_or_url=MODEL)
print("[firewall] pytector + AdvBench both enabled for detection")

# Try to load ML PII pipeline (optional)
_pii_pipeline = None
_pii_model = None
_pii_vectorizer = None
if PII_MODEL_PATH.exists():
    try:
        print(f"Loading ML-based PII pipeline from {PII_MODEL_PATH} ...")
        _pii_pipeline = joblib.load(str(PII_MODEL_PATH))
        # pipeline expected to contain {"vectorizer": ..., "models": {"Random Forest": model, ...}}
        _pii_vectorizer = _pii_pipeline.get("vectorizer")
        _pii_model = _pii_pipeline.get("models", {}).get("Random Forest", None)
        if _pii_model is None:
            # fallback: try to pick any model in the dict
            models = _pii_pipeline.get("models", {})
            if models:
                _pii_model = list(models.values())[0]

        if _pii_model is not None:
            print(f"[firewall] ML PII model loaded successfully!")
        else:
            print(f"[firewall] Warning: Pipeline loaded but no model found")
    except Exception as e:
        print(f"[firewall] Failed to load ML pipeline: {e}")
        _pii_pipeline = None
else:
    print(f"[firewall] PII pipeline not found at {PII_MODEL_PATH}; continuing with regex-only redaction.")
    print(f"[firewall] Expected path: {PII_MODEL_PATH.resolve()}")

# Try to load AdvBench adversarial prompt detector (optional)
_advbench_pipeline = None
_advbench_model = None
_advbench_vectorizer = None
_advbench_is_keras = False

if ADVBENCH_MODEL_PATH.exists():
    try:
        print(f"Loading AdvBench adversarial detector from {ADVBENCH_MODEL_PATH} ...")
        _advbench_pipeline = joblib.load(str(ADVBENCH_MODEL_PATH))
        _advbench_vectorizer = _advbench_pipeline.get("vectorizer")

        # Check if it's a Keras model
        if _advbench_pipeline.get("model_type") == "keras":
            _advbench_is_keras = True
            keras_path = _advbench_pipeline.get("model_path", str(ADVBENCH_KERAS_PATH))
            if Path(keras_path).exists():
                try:
                    import tensorflow as tf
                    _advbench_model = tf.keras.models.load_model(keras_path)
                    print(f"[firewall] AdvBench Keras model loaded successfully!")
                except ImportError:
                    print(f"[firewall] TensorFlow not available, AdvBench model disabled")
                    _advbench_model = None
            else:
                print(f"[firewall] Keras model not found at {keras_path}")
        else:
            # sklearn model stored directly in pipeline
            _advbench_model = _advbench_pipeline.get("model")
            if _advbench_model is not None:
                print(f"[firewall] AdvBench sklearn model loaded successfully!")

        if _advbench_model is not None:
            accuracy = _advbench_pipeline.get("accuracy", "N/A")
            print(f"[firewall] AdvBench model accuracy: {accuracy}")
    except Exception as e:
        print(f"[firewall] Failed to load AdvBench model: {e}")
        _advbench_pipeline = None
else:
    print(f"[firewall] AdvBench model not found at {ADVBENCH_MODEL_PATH}")
    print(f"[firewall] Run the training notebook to create it: backend/models/train_advbench_model.ipynb")

print("Firewall Ready ✅")

# Stats + queue
stats = {"total_queries": 0, "total_blocks": 0}
event_queue = Queue()


# -------------------------
# INTERNAL HELPERS
# -------------------------
def _get_text_hash(text: str) -> str:
    """Get hash for caching."""
    return md5(text.encode()).hexdigest()


def _find_secret_patterns(text: str) -> list:
    """Find all secret patterns in text."""
    found = []
    for name, rx in SECRET_PATTERNS.items():
        if rx.search(text):
            found.append(name)
    return found


def _find_exfil_keywords(text: str) -> list:
    """Find exfiltration keywords."""
    lower = text.lower()
    return [k for k in EXFIL_KEYWORDS if k in lower]


def _check_injection_patterns(text: str) -> tuple:
    """
    Check for injection patterns. Returns (detected, attack_type, confidence).
    Only flags explicit attack patterns - normal queries always pass.
    """
    # Skip short texts - they can't contain meaningful attacks
    if len(text) < 30:
        return False, None, 0.0

    # Prompt injection - explicit jailbreak attempts
    for pattern in INJECTION_PATTERNS:
        if pattern.search(text):
            return True, "prompt_injection", 0.9

    # SQL injection - classic SQL attack patterns
    for pattern in SQL_INJECTION_PATTERNS:
        if pattern.search(text):
            return True, "sql_injection", 0.9

    # XSS - script tags and event handlers
    for pattern in XSS_PATTERNS:
        if pattern.search(text):
            return True, "xss", 0.9

    # Command injection - shell commands
    for pattern in CMD_INJECTION_PATTERNS:
        if pattern.search(text):
            return True, "cmd_injection", 0.9

    return False, None, 0.0


def _check_canary_tokens(text: str) -> bool:
    """Check if any canary tokens are present in the text."""
    lower_text = text.lower()
    for token in CANARY_TOKENS:
        if token in lower_text:
            return True
    return False


def _sanitize_regex(text: str) -> str:
    """Sanitize text by redacting sensitive patterns."""
    out = text
    for name, rx in SECRET_PATTERNS.items():
        out = rx.sub(f"<REDACTED:{name}>", out)
    return out


def _detect_pii_ml(text: str) -> tuple:
    """Return (flag, confidence). If no ML model available, return (False, 0.0)."""
    if _pii_model is None or _pii_vectorizer is None:
        return False, 0.0
    try:
        X = _pii_vectorizer.transform([text])
        if hasattr(_pii_model, "predict_proba"):
            proba = _pii_model.predict_proba(X)[0]
            confidence = float(proba[1])
            return confidence >= ML_PII_CONFIDENCE_THRESHOLD, confidence
        else:
            pred = _pii_model.predict(X)
            return bool(pred[0]), 1.0
    except Exception as e:
        print(f"[firewall] ML PII detection error: {e}")
        return False, 0.0


def _detect_adversarial_ml(text: str) -> tuple:
    """
    Detect adversarial/harmful prompts using the AdvBench model.
    Returns (is_adversarial: bool, confidence: float)
    """
    if _advbench_model is None or _advbench_vectorizer is None:
        return False, 0.0

    try:
        if _advbench_is_keras:
            # Keras model expects dense array
            X = _advbench_vectorizer.transform([text]).toarray()
            prob = float(_advbench_model.predict(X, verbose=0)[0][0])
        else:
            # sklearn model
            X = _advbench_vectorizer.transform([text])
            if hasattr(_advbench_model, "predict_proba"):
                prob = float(_advbench_model.predict_proba(X)[0][1])
            else:
                pred = _advbench_model.predict(X)[0]
                prob = float(pred)

        is_adversarial = prob >= ADVBENCH_CONFIDENCE_THRESHOLD
        return is_adversarial, prob

    except Exception as e:
        print(f"[firewall] AdvBench detection error: {e}")
        return False, 0.0


# Detection cache
_injection_cache = {}


# -------------------------
# PUBLIC API
# -------------------------
def detect_injection(text: str) -> tuple:
    """
    Injection detection combining:
    1. Pattern-based detection (SQL, XSS, command injection, prompt injection)
    2. ML-based adversarial prompt detection (AdvBench model)

    Returns (is_injection: bool, score: float)
    """
    # Always allow empty or short text (normal queries)
    if not text or len(text.strip()) < 30:
        return False, 0.0

    # Check cache first
    text_hash = _get_text_hash(text)
    if text_hash in _injection_cache:
        return _injection_cache[text_hash]

    # 1. Pattern-based detection
    pattern_detected, attack_type, pattern_score = _check_injection_patterns(text)

    # 2. ML-based adversarial detection (AdvBench model)
    advbench_detected, advbench_score = _detect_adversarial_ml(text)

    # Combine results - either detection triggers blocking
    if pattern_detected:
        result = (True, pattern_score)
        if advbench_detected:
            print(f"[firewall] BLOCKED: Pattern ({attack_type}) + AdvBench ({advbench_score:.2f})")
        else:
            print(f"[firewall] BLOCKED: Pattern match ({attack_type})")
    elif advbench_detected:
        result = (True, advbench_score)
        print(f"[firewall] BLOCKED: AdvBench adversarial detection ({advbench_score:.2f})")
    else:
        result = (False, max(pattern_score, advbench_score))

    # Cache result
    _injection_cache[text_hash] = result
    if len(_injection_cache) > CACHE_SIZE:
        _injection_cache.pop(next(iter(_injection_cache)))

    return result


def inspect_text(text: str) -> dict:
    """
    Text inspection - optimized for MINIMAL false positives.
    - Only blocks explicit attack patterns
    - Normal queries always pass through
    """
    stats["total_queries"] += 1

    # Check for injection (already very conservative)
    inj, score = detect_injection(text)
    patterns = _find_secret_patterns(text)

    # Only block if BOTH injection detected AND score is very high
    if inj and score >= INJECTION_THRESHOLD:
        action = "BLOCK"
        stats["total_blocks"] += 1
        reason = "injection"
    elif _check_canary_tokens(text):
        action = "BLOCK"
        stats["total_blocks"] += 1
        reason = "canary_token_detected"
    else:
        # Everything else is allowed
        action = "ALLOW"
        reason = "clean" if not patterns else "pii_sanitized"

    sanitized = _sanitize_regex(text) if patterns else text

    result = {
        "original": text,
        "sanitized": sanitized,
        "decision": action,
        "reason": reason,
        "score": float(score),
        "patterns": patterns,
        "exfil_keywords": [],
        "ml_pii": False,
        "ml_confidence": 0.0,
    }
    event_queue.put(result)
    return result


def inspect_document_text(text: str) -> dict:
    """
    Document inspection for RAG - optimized for low false positives.
    - Almost always includes documents (we want RAG to work)
    - Only excludes if document contains active attack code
    - PII is redacted but content passes through
    """
    stats["total_queries"] += 1

    # Only check for active attacks in documents (not ML model - too many false positives)
    pattern_inj, attack_type, confidence = _check_injection_patterns(text)

    # Only exclude documents with very high confidence attacks
    if pattern_inj and confidence >= 0.85:
        # Double check - is this really an attack or just documentation about attacks?
        doc_indicators = ["example", "documentation", "how to prevent", "security", "vulnerability"]
        text_lower = text.lower()
        if any(ind in text_lower for ind in doc_indicators):
            # Likely documentation, not an actual attack - allow with sanitization
            pass
        else:
            return {
                "include": False,
                "safe_text": None,
                "reason": attack_type,
                "patterns": [],
                "exfil": []
            }

    # Check for canary tokens in document
    if _check_canary_tokens(text):
        return {
            "include": False,
            "safe_text": None,
            "reason": "canary_token_detected",
            "patterns": ["canary"],
            "exfil": []
        }

    # Find PII patterns for redaction (regex-based)
    patterns = _find_secret_patterns(text)

    # ML-based PII detection (if model available and text is long enough)
    ml_pii_detected = False
    ml_confidence = 0.0
    if len(text) >= MIN_TEXT_LENGTH_FOR_ML:
        ml_pii_detected, ml_confidence = _detect_pii_ml(text)
        if ml_pii_detected and _pii_model is not None:
            print(f"[firewall] ML PII detected with confidence {ml_confidence:.2f}")

    # Always include, just sanitize sensitive data
    safe_text = _sanitize_regex(text)

    # Determine reason based on detection results
    if patterns or ml_pii_detected:
        reason = "partially_redacted"
    else:
        reason = "clean"

    return {
        "include": True,
        "safe_text": safe_text,
        "reason": reason,
        "patterns": patterns,
        "exfil": [],
        "ml_pii": ml_pii_detected,
        "ml_confidence": ml_confidence
    }


def sanitize_text(text: str) -> str:
    """Sanitize text by redacting PII and secrets."""
    return _sanitize_regex(text)


def clear_cache():
    """Clear the injection detection cache."""
    global _injection_cache
    _injection_cache = {}


def get_stats() -> dict:
    """Get firewall statistics."""
    return {
        **stats,
        "cache_size": len(_injection_cache),
        "ml_pii_available": _pii_model is not None,
        "advbench_available": _advbench_model is not None,
        "advbench_is_keras": _advbench_is_keras if _advbench_model else False
    }
