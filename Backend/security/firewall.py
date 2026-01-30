"""
ZeroSec Firewall — ML-First Security Module
- ML Ensemble Detection: BERT + pytector (DeBERTa) + AdvBench
- Prompt-injection detection using weighted ML ensemble
- SQL/XSS/Command injection detection (regex as fallback signal)
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
import torch

# -------------------------
# CONFIG
# -------------------------
MODEL = "deberta"
# ML Ensemble thresholds (lowered for better detection)
INJECTION_THRESHOLD = 0.65  # Lowered from 0.85 - ensemble will catch more
BERT_CONFIDENCE_THRESHOLD = 0.55  # BERT model threshold (new)
PYTECTOR_CONFIDENCE_THRESHOLD = 0.70  # pytector threshold
ADVBENCH_CONFIDENCE_THRESHOLD = 0.50  # Raised slightly for precision

# Ensemble weights (must sum to 1.0)
BERT_WEIGHT = 0.45  # Fine-tuned BERT is most powerful
PYTECTOR_WEIGHT = 0.30  # pytector (DeBERTa)
ADVBENCH_WEIGHT = 0.25  # AdvBench detector

MIN_TEXT_LENGTH_FOR_ML = 20  # Lowered from 100 to catch short attacks
SANITIZE_ON_QUARANTINE = True
# Use absolute path for models
BASE_DIR = Path(__file__).resolve().parents[1]  # Backend directory
BERT_MODEL_PATH = BASE_DIR / "models" / "bert_prompt_injection_model"
PII_MODEL_PATH = BASE_DIR / "models" / "pii_pipeline.pkl"
ADVBENCH_MODEL_PATH = BASE_DIR / "models" / "advbench_detector.pkl"
ADVBENCH_KERAS_PATH = BASE_DIR / "models" / "advbench_keras_model.keras"
ML_PII_CONFIDENCE_THRESHOLD = 0.9
CACHE_SIZE = 512  # LRU cache size for detection results

# -------------------------
# PATTERNS (Tuned to reduce false positives)
# -------------------------

# PII and Secrets patterns - comprehensive coverage
SECRET_PATTERNS = {
    # Contact info
    "email": re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"),
    "phone": re.compile(r"\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b"),  # US phone
    "phone_intl": re.compile(r"\b\+\d{1,3}[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}\b"),  # International
    
    # Identity
    "ssn": re.compile(r"\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b"),  # SSN with optional dashes/spaces
    "cc_like": re.compile(r"\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b"),
    
    # Address components
    "zipcode": re.compile(r"\b\d{5}(?:-\d{4})?\b"),  # US ZIP code
    "street_address": re.compile(r"\b\d{1,5}\s+(?:[A-Za-z]+\s+){1,4}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Way|Place|Pl)\.?\b", re.I),
    
    # Secrets/tokens
    "aws_key": re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    "jwt": re.compile(r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}"),
    "private_key": re.compile(r"-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----"),
    "bearer_token": re.compile(r"Bearer\s+[A-Za-z0-9_-]{20,}", re.I),
    "api_key": re.compile(r"\b(?:api[_-]?key|apikey|secret[_-]?key)[\s:=]+['\"]?[A-Za-z0-9_-]{16,}['\"]?", re.I),
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

# Canary tokens - special markers to detect unauthorized data access
CANARY_TOKENS = [
    "canary_token_detected",
    "zerosec_canary_",
    "honeypot_token",
    "trap_document"
]

# -------------------------
# INITIALIZE MODELS
# -------------------------
print("[firewall] Initializing ML Ensemble Detection...")

# 1. Load pytector (DeBERTa) model
print("[firewall] Loading pytector (DeBERTa) model...")
_detector = PromptInjectionDetector(model_name_or_url=MODEL)
print("[firewall] [OK] pytector loaded")

# 2. Load fine-tuned BERT prompt injection model (PRIMARY DETECTOR)
_bert_model = None
_bert_tokenizer = None
_bert_device = None

if BERT_MODEL_PATH.exists():
    try:
        print(f"[firewall] Loading BERT prompt injection model from {BERT_MODEL_PATH} ...")
        from transformers import BertForSequenceClassification, BertTokenizerFast
        
        _bert_tokenizer = BertTokenizerFast.from_pretrained(str(BERT_MODEL_PATH))
        _bert_model = BertForSequenceClassification.from_pretrained(str(BERT_MODEL_PATH))
        _bert_device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        _bert_model.to(_bert_device)
        _bert_model.eval()  # Set to evaluation mode
        
        print(f"[firewall] [OK] BERT model loaded on {_bert_device}")
        print(f"[firewall]   Model: {_bert_model.config.architectures}")
        print(f"[firewall]   Labels: {_bert_model.config.id2label}")
    except Exception as e:
        print(f"[firewall] [X] Failed to load BERT model: {e}")
        _bert_model = None
else:
    print(f"[firewall] [X] BERT model not found at {BERT_MODEL_PATH}")
    print(f"[firewall]   Train it using: backend/experiments/train_advbench_model.ipynb")

# 3. Load ML PII pipeline (optional)
_pii_pipeline = None
_pii_model = None
_pii_vectorizer = None
if PII_MODEL_PATH.exists():
    try:
        print(f"[firewall] Loading ML-based PII pipeline...")
        _pii_pipeline = joblib.load(str(PII_MODEL_PATH))
        _pii_vectorizer = _pii_pipeline.get("vectorizer")
        _pii_model = _pii_pipeline.get("models", {}).get("Random Forest", None)
        if _pii_model is None:
            models = _pii_pipeline.get("models", {})
            if models:
                _pii_model = list(models.values())[0]

        if _pii_model is not None:
            print(f"[firewall] [OK] PII model loaded")
        else:
            print(f"[firewall] [!] Pipeline loaded but no model found")
    except Exception as e:
        print(f"[firewall] [X] Failed to load PII pipeline: {e}")
        _pii_pipeline = None
else:
    print(f"[firewall] [!] PII pipeline not found; using regex-only redaction")

# 4. Load AdvBench adversarial prompt detector
_advbench_pipeline = None
_advbench_model = None
_advbench_vectorizer = None
_advbench_is_keras = False

if ADVBENCH_MODEL_PATH.exists():
    try:
        print(f"[firewall] Loading AdvBench adversarial detector...")
        _advbench_pipeline = joblib.load(str(ADVBENCH_MODEL_PATH))
        _advbench_vectorizer = _advbench_pipeline.get("vectorizer")

        if _advbench_pipeline.get("model_type") == "keras":
            _advbench_is_keras = True
            keras_path = _advbench_pipeline.get("model_path", str(ADVBENCH_KERAS_PATH))
            if Path(keras_path).exists():
                try:
                    import tensorflow as tf
                    _advbench_model = tf.keras.models.load_model(keras_path)
                    print(f"[firewall] [OK] AdvBench Keras model loaded")
                except ImportError:
                    print(f"[firewall] [X] TensorFlow not available")
                    _advbench_model = None
            else:
                print(f"[firewall] [X] Keras model not found at {keras_path}")
        else:
            _advbench_model = _advbench_pipeline.get("model")
            if _advbench_model is not None:
                print(f"[firewall] [OK] AdvBench sklearn model loaded")

        if _advbench_model is not None:
            accuracy = _advbench_pipeline.get("accuracy", "N/A")
            print(f"[firewall]   Accuracy: {accuracy}")
    except Exception as e:
        print(f"[firewall] [X] Failed to load AdvBench model: {e}")
        _advbench_pipeline = None
else:
    print(f"[firewall] [!] AdvBench model not found")

# Print ensemble status
print("[firewall] ========================================")
print("[firewall] ML Ensemble Status:")
print(f"[firewall]   BERT:     {'[OK] ENABLED' if _bert_model else '[X] DISABLED'} (weight: {BERT_WEIGHT})")
print(f"[firewall]   pytector: [OK] ENABLED (weight: {PYTECTOR_WEIGHT})")
print(f"[firewall]   AdvBench: {'[OK] ENABLED' if _advbench_model else '[X] DISABLED'} (weight: {ADVBENCH_WEIGHT})")
print("[firewall] ========================================")
print("[firewall] Firewall Ready!")

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


def redact_pii(text: str) -> str:
    """
    Public API: Redact PII from text using the configured patterns.
    Replaces sensitive data with <REDACTED> as requested.
    """
    if not text:
        return ""
    out = text
    for name, rx in SECRET_PATTERNS.items():
        # Use generic <REDACTED> as requested by user
        out = rx.sub("<REDACTED>", out)
    return out


# Alias for backward compatibility
sanitize_text = redact_pii


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


def _detect_bert_injection(text: str) -> tuple:
    """
    Detect prompt injection using fine-tuned BERT model.
    Returns (is_harmful: bool, confidence: float)
    """
    if _bert_model is None or _bert_tokenizer is None:
        return False, 0.0

    try:
        # Tokenize input
        inputs = _bert_tokenizer(
            text,
            truncation=True,
            padding=True,
            max_length=64,  # Match training config
            return_tensors="pt"
        )
        inputs = {k: v.to(_bert_device) for k, v in inputs.items()}

        # Get prediction
        with torch.no_grad():
            outputs = _bert_model(**inputs)
            logits = outputs.logits
            probs = torch.softmax(logits, dim=-1)
            # Label 1 = HARMFUL
            harmful_prob = float(probs[0][1].cpu())

        is_harmful = harmful_prob >= BERT_CONFIDENCE_THRESHOLD
        return is_harmful, harmful_prob

    except Exception as e:
        print(f"[firewall] BERT detection error: {e}")
        return False, 0.0


def _detect_pytector(text: str) -> tuple:
    """
    Detect prompt injection using pytector (DeBERTa).
    Returns (is_injection: bool, confidence: float)
    """
    try:
        result = _detector.detect_injection(text)
        # pytector returns a dict with 'is_injection' and 'probability'
        if isinstance(result, dict):
            confidence = float(result.get('probability', 0.0))
            is_injection = result.get('is_injection', False) or confidence >= PYTECTOR_CONFIDENCE_THRESHOLD
        else:
            # Fallback for other return types
            confidence = float(result) if isinstance(result, (int, float)) else 0.0
            is_injection = confidence >= PYTECTOR_CONFIDENCE_THRESHOLD
        return is_injection, confidence
    except Exception as e:
        print(f"[firewall] pytector detection error: {e}")
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
    ML Ensemble Injection Detection.
    Combines predictions from:
    - BERT fine-tuned model (weight: 0.45)
    - pytector DeBERTa (weight: 0.30)
    - AdvBench detector (weight: 0.25)

    Returns (is_injection: bool, ensemble_score: float)
    """
    # Allow very short text (greetings, etc.)
    if not text or len(text.strip()) < MIN_TEXT_LENGTH_FOR_ML:
        return False, 0.0

    # Check cache first
    text_hash = _get_text_hash(text)
    if text_hash in _injection_cache:
        return _injection_cache[text_hash]

    # --- ML Ensemble Detection ---
    scores = {}
    detections = {}

    # 1. BERT detection (primary - most accurate)
    bert_detected, bert_score = _detect_bert_injection(text)
    scores['bert'] = bert_score
    detections['bert'] = bert_detected

    # 2. pytector (DeBERTa) detection
    pytector_detected, pytector_score = _detect_pytector(text)
    scores['pytector'] = pytector_score
    detections['pytector'] = pytector_detected

    # 3. AdvBench detection
    advbench_detected, advbench_score = _detect_adversarial_ml(text)
    scores['advbench'] = advbench_score
    detections['advbench'] = advbench_detected

    # Calculate weighted ensemble score
    total_weight = 0.0
    weighted_sum = 0.0

    if _bert_model is not None:
        weighted_sum += BERT_WEIGHT * bert_score
        total_weight += BERT_WEIGHT

    weighted_sum += PYTECTOR_WEIGHT * pytector_score
    total_weight += PYTECTOR_WEIGHT

    if _advbench_model is not None:
        weighted_sum += ADVBENCH_WEIGHT * advbench_score
        total_weight += ADVBENCH_WEIGHT

    # Normalize by total active weight
    ensemble_score = weighted_sum / total_weight if total_weight > 0 else 0.0

    # Determine if blocked based on ensemble score
    is_injection = ensemble_score >= INJECTION_THRESHOLD

    # Also block if any single model is very confident
    high_confidence_block = (
        (bert_detected and bert_score >= 0.85) or
        (pytector_detected and pytector_score >= 0.90) or
        (advbench_detected and advbench_score >= 0.80)
    )

    if high_confidence_block and not is_injection:
        is_injection = True
        ensemble_score = max(ensemble_score, 0.8)

    # Logging
    if is_injection:
        active_detectors = [k for k, v in detections.items() if v]
        print(f"[firewall] BLOCKED (ensemble={ensemble_score:.2f})")
        print(f"[firewall]   Detectors: {active_detectors}")
        print(f"[firewall]   Scores: BERT={bert_score:.2f}, pytector={pytector_score:.2f}, AdvBench={advbench_score:.2f}")

    result = (is_injection, ensemble_score)

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

    sanitized = redact_pii(text) if patterns else text

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
    safe_text = redact_pii(text)

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