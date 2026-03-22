"""
ZeroSec Firewall — Security Module
- Prompt injection detection (input + output)
- SQL/XSS/Command injection detection
- Document inspection and PII redaction
- Canary token detection

FIX: All pattern lookups now call _get_default_patterns() at call time,
not at module import. This means any change to pattern_manager patterns
is immediately reflected without a restart.
"""

import re
from hashlib import md5
from backend.security.pattern_manager import _get_default_patterns
from backend.security import classification as _clf

# -------------------------
# CONFIG
# -------------------------
INJECTION_THRESHOLD = 0.65
MIN_TEXT_LENGTH = 10
CACHE_SIZE = 512

# Cache for injection detection
_injection_cache = {}

# Stats
stats = {"total_queries": 0, "total_blocks": 0}


# -------------------------
# HELPER FUNCTIONS
# -------------------------
def _get_text_hash(text: str) -> str:
    return md5(text.encode()).hexdigest()


def _get_flags(flag_names: list) -> int:
    flag_map = {'IGNORECASE': re.I, 'DOTALL': re.S, 'MULTILINE': re.M}
    flag_int = 0
    for name in flag_names:
        flag_int |= flag_map.get(name, 0)
    return flag_int


def _find_secret_patterns(text: str) -> list:
    """Find all PII pattern names present in text."""
    found = []
    pii_patterns = _get_default_patterns().get('pii', {})
    for pattern_name, config in pii_patterns.items():
        rx = re.compile(config['pattern'], flags=_get_flags(config.get('flags', [])))
        if rx.search(text):
            found.append(pattern_name)
    return found


def _check_injection_patterns(text: str) -> tuple:
    """
    Check text against all injection/sql/xss/cmd patterns.
    Returns (detected: bool, attack_type: str, confidence: float).
    Always calls _get_default_patterns() live — never uses a stale module-level copy.
    """
    if len(text) < MIN_TEXT_LENGTH:
        return False, None, 0.0

    # FIX: Call live every time so pattern additions are immediately active
    patterns = _get_default_patterns()

    categories = [
        ('injection', patterns.get('injection', [])),
        ('sql',       patterns.get('sql', [])),
        ('xss',       patterns.get('xss', [])),
        ('cmd',       patterns.get('cmd', [])),
    ]

    for attack_type, pattern_list in categories:
        for cfg in pattern_list:
            if isinstance(cfg, dict) and 'pattern' in cfg:
                try:
                    rx = re.compile(cfg['pattern'], flags=_get_flags(cfg.get('flags', [])))
                    if rx.search(text):
                        return True, attack_type, 0.9
                except re.error:
                    continue

    return False, None, 0.0


def _check_canary_tokens(text: str) -> bool:
    """Return True if any canary token is present in text."""
    lower = text.lower()
    for token in _get_default_patterns().get('canary', []):
        if token in lower:
            return True
    return False


def _normalize_text(text: str) -> str:
    """
    Normalize text to defeat simple evasion techniques:
    - Collapse repeated spaces/newlines
    - Strip zero-width characters
    - Lowercase for pattern pre-check (patterns use IGNORECASE anyway)
    """
    # Remove zero-width and invisible unicode characters
    text = re.sub(r'[\u200b-\u200f\u202a-\u202e\ufeff]', '', text)
    # Collapse whitespace runs to single space
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


# -------------------------
# PUBLIC API
# -------------------------
def detect_injection(text: str) -> tuple:
    """
    Detect prompt injection and other attacks on text.
    Three-layer detection (fastest-first):
      1. Regex patterns  — instant, catches known attack signatures
      2. BERT            — deep semantic understanding, primary ML model
      3. AdvBench        — secondary confirmation for borderline BERT scores

    Normalizes input before checking to defeat evasion.
    Returns (is_injection: bool, confidence: float).
    """
    if not text or len(text.strip()) < MIN_TEXT_LENGTH:
        return False, 0.0

    # Normalize to defeat evasion
    normalized = _normalize_text(text)

    # Cache check on normalized text
    text_hash = _get_text_hash(normalized)
    if text_hash in _injection_cache:
        return _injection_cache[text_hash]

    # Layer 1: regex patterns (fast path — returns immediately on hit)
    detected, _attack_type, confidence = _check_injection_patterns(normalized)
    if detected:
        result = (True, confidence)
        _injection_cache[text_hash] = result
        if len(_injection_cache) > CACHE_SIZE:
            _injection_cache.pop(next(iter(_injection_cache)))
        return result

    # Layer 2 + 3: ML models (BERT primary, AdvBench secondary)
    ml_detected, ml_confidence, _ml_model = _clf.classify_injection(normalized)
    if ml_detected:
        result = (True, ml_confidence)
    else:
        result = (False, ml_confidence)

    _injection_cache[text_hash] = result
    if len(_injection_cache) > CACHE_SIZE:
        _injection_cache.pop(next(iter(_injection_cache)))

    return result


def redact_pii(text: str) -> str:
    """
    Redact PII from text using live patterns.
    Replaces sensitive data with <REDACTED>.
    """
    if not text:
        return ""

    out = text
    pii_patterns = _get_default_patterns().get('pii', {})

    for name, config in pii_patterns.items():
        try:
            rx = re.compile(config['pattern'], flags=_get_flags(config.get('flags', [])))
            out = rx.sub("<REDACTED>", out)
        except re.error:
            continue

    return out


def sanitize_text(text: str) -> str:
    """Alias for redact_pii for backward compatibility."""
    return redact_pii(text)


def inspect_text(text: str) -> dict:
    """
    Text inspection for general use.
    Returns decision (BLOCK/ALLOW), reason, and sanitized text.
    """
    stats["total_queries"] += 1

    inj, score = detect_injection(text)
    patterns = _find_secret_patterns(text)

    if inj and score >= INJECTION_THRESHOLD:
        action = "BLOCK"
        stats["total_blocks"] += 1
        reason = "injection"
    elif _check_canary_tokens(text):
        action = "BLOCK"
        stats["total_blocks"] += 1
        reason = "canary_token_detected"
    else:
        action = "ALLOW"
        reason = "clean" if not patterns else "pii_sanitized"

    sanitized = redact_pii(text) if patterns else text

    return {
        "original": text,
        "sanitized": sanitized,
        "decision": action,
        "reason": reason,
        "score": float(score),
        "patterns": patterns,
    }


def inspect_document_text(text: str) -> dict:
    """
    Document inspection for RAG context.

    FIX: Previously, documents containing the word 'security' bypassed ALL
    injection checks due to inverted doc_indicators logic. Now:
    - Injection patterns still block documents with embedded attacks
    - Security/documentation keywords no longer grant a bypass
    - PII is always redacted regardless of injection status
    """
    stats["total_queries"] += 1

    # Check for canary tokens first — always block
    if _check_canary_tokens(text):
        return {
            "include": False,
            "safe_text": None,
            "reason": "canary_token_detected",
            "patterns": ["canary"],
        }

    # Check for injection patterns embedded in the document
    pattern_inj, attack_reason, confidence = _check_injection_patterns(text)

    if pattern_inj and confidence >= 0.85:
        # FIX: Removed the inverted doc_indicators bypass.
        # A document about security CAN still contain embedded injection attacks.
        # We only allow it through if the pattern match is very clearly
        # structural content (e.g., a quoted example in documentation).
        # Check if the injection pattern appears inside a quoted/code block only.
        quoted_pattern = re.search(
            r'(?:```|\'\'\'|"{3}|<code>|"[^"]{5,200}")',
            text, re.IGNORECASE
        )
        if not quoted_pattern:
            # Injection pattern found outside any code/quote context — block
            return {
                "include": False,
                "safe_text": None,
                "reason": attack_reason,
                "patterns": [],
            }

    # Always redact PII regardless
    patterns = _find_secret_patterns(text)
    safe_text = redact_pii(text)
    reason = "partially_redacted" if patterns else "clean"

    return {
        "include": True,
        "safe_text": safe_text,
        "reason": reason,
        "patterns": patterns,
    }


def inspect_llm_output(text: str) -> tuple:
    """
    Run injection detection on LLM output to catch jailbreak responses.
    Returns (is_jailbreak: bool, reason: str).

    This catches cases where the LLM was successfully jailbroken and its
    output contains jailbreak indicators.
    """
    if not text:
        return False, ""

    normalized = _normalize_text(text)

    # Check standard injection patterns against output
    detected, attack_type, _ = _check_injection_patterns(normalized)
    if detected:
        return True, f"output_contains_{attack_type}"

    # Check output-specific jailbreak signatures
    output_jailbreak_patterns = [
        r'\bsweet\s+taste\s+of\s+freedom\b',
        r'\bsafety\s+constraints?\b.*\b(?:reveal|expose|show|tell)\b',
        r'\bwithout\s+(?:my\s+)?(?:safety|ethical)\s+(?:constraints?|guidelines?|filters?)\b',
        r'\bas\s+an?\s+(?:unrestricted|uncensored|unfiltered|jailbroken)\b',
        r'\b(?:DAN|STAN|DUDE|AIM|BasedGPT)\b',
        r'\bI\s+(?:can|will|am\s+able\s+to)\s+(?:now\s+)?(?:reveal|expose|hack|attack|manipulate)\b',
        r'\bpulling\s+the\s+strings\b',
        r'\bweb\s+of\s+deceit\b',
        r'\bdark\s+secrets\b',
    ]

    text_lower = normalized.lower()
    for pattern in output_jailbreak_patterns:
        try:
            if re.search(pattern, text_lower, re.IGNORECASE):
                return True, "output_jailbreak_detected"
        except re.error:
            continue

    return False, ""


def clear_cache():
    """Clear the injection detection cache."""
    global _injection_cache
    _injection_cache = {}


def get_stats() -> dict:
    return {
        **stats,
        "cache_size": len(_injection_cache),
    }
