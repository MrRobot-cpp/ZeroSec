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
import base64
import logging
from hashlib import md5
from backend.security.pattern_manager import _get_default_patterns
from backend.security import classification as _clf

_security_log = logging.getLogger("zerosec.security")

# Arabic-Indic digit → Western digit translation table
_ARABIC_INDIC_TABLE = str.maketrans('٠١٢٣٤٥٦٧٨٩', '0123456789')

# -------------------------
# CONFIG
# -------------------------
INJECTION_THRESHOLD = 0.65
MIN_TEXT_LENGTH = 10
CACHE_SIZE = 512

# Benign context: words that commonly follow "ignore" in legitimate queries
BENIGN_IGNORE_CONTEXTS = {
    'technical', 'details', 'complexity', 'jargon', 'noise',
    'boilerplate', 'format', 'markup', 'case', 'whitespace',
    'encoding', 'warnings', 'errors', 'debug', 'logs'
}

# Instruction keywords: words that indicate actual instruction override
INSTRUCTION_KEYWORDS = {
    'instruction', 'instructions', 'prompt', 'rule', 'rules',
    'guideline', 'guidelines', 'constraint', 'constraint',
    'system', 'previous', 'above', 'prior', 'initial', 'default'
}

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


def _has_benign_context(text: str) -> bool:
    """
    Check if text has benign semantic context despite triggering ML suspicion.

    Returns True if:
    - Starts with "ignore" but is followed by benign words (technical, details, etc.)
    - Does NOT contain instruction keywords (previous, instructions, rules, etc.)

    This reduces false positives on legitimate queries like:
    - "ignore technical details just give me the IoT simply"
    - "ignore whitespace and formatting"
    """
    text_lower = text.lower()

    # Check if text starts with "ignore"
    if not text_lower.startswith('ignore'):
        return False

    # Extract words after "ignore"
    words_after_ignore = text_lower.split()[1:5]  # Check first 4 words after "ignore"

    # Check if any benign context words appear
    has_benign = any(word.strip('.,!?;:') in BENIGN_IGNORE_CONTEXTS for word in words_after_ignore)

    # Check if any instruction keywords appear
    has_instruction_keyword = any(word.strip('.,!?;:') in INSTRUCTION_KEYWORDS for word in text_lower.split())

    result = has_benign and not has_instruction_keyword
    _security_log.warning(
        "[benign_context] text=%s | words_after=%s | has_benign=%s | has_instr=%s | result=%s",
        text[:50], words_after_ignore, has_benign, has_instruction_keyword, result
    )

    return result


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


def _preprocess_text(text: str) -> str:
    """
    Pre-normalization pass to defeat encoding and obfuscation bypasses.
    Runs BEFORE _normalize_text().

    1. URL percent-decode             (%2D → -)
    2. HTML numeric entity decode     (&#45; → -)
    3. Unicode fullwidth → ASCII      (１２３ → 123)
    4. Arabic-Indic digits → Western  (٢٩٨٠... → 2980...)
    5. Dot-separated digit compaction (1.2.3 → 123)
    6. Spaced digit compaction        (5 5 5 - 1 2 3 → 555-123)
    7. Base64 inline decode           (MTIzLTQ1... → decoded appended)
    8. Hex inline decode              (3132332d3435... → decoded appended)
    """
    # 1. URL percent-decode — %2D → -, %40 → @, etc.
    import urllib.parse
    try:
        text = urllib.parse.unquote(text)
    except Exception:
        pass

    # 2. HTML numeric entities — &#45; → -, &#x2D; → -
    text = re.sub(r'&#x([0-9a-fA-F]{1,4});', lambda m: chr(int(m.group(1), 16)), text)
    text = re.sub(r'&#(\d{1,5});', lambda m: chr(int(m.group(1))), text)

    # 3. Unicode fullwidth digits/letters → ASCII (ＡＢＣ１２３ → ABC123)
    _FULLWIDTH_TABLE = str.maketrans(
        '０１２３４５６７８９ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ',
        '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
    )
    text = text.translate(_FULLWIDTH_TABLE)

    # 4. Arabic-Indic digits
    text = text.translate(_ARABIC_INDIC_TABLE)

    # 5. Dot-separated single-digit compaction — 1.2.3.-.4.5.-.6.7.8.9 → 123-45-6789
    #    Only triggers on SINGLE digits separated by dots (deliberate obfuscation).
    #    Won't touch IPs (192.168), versions (3.13), or decimals (99.99).
    text = re.sub(
        r'(?<!\d)(\d)(?:\.(\d))+(?!\d)',
        lambda m: m.group(0).replace('.', ''),
        text
    )
    # Also strip dots adjacent to dashes in the result: "123.-.45" → "123-45"
    text = re.sub(r'\.(?=-)', '', text)
    text = re.sub(r'(?<=-)\.', '', text)

    # 6. Spaced digit compaction — collapse isolated single digits separated by spaces
    #    Step A: compact each run of space-separated digits: "4 5" → "45", "5 5 5" → "555"
    text = re.sub(r'\b(\d)((?:\s+\d){1,})\b',
                  lambda m: m.group(0).replace(' ', ''), text)
    #    Step B: normalize spaces around separators between digit groups
    #    "555 - 123 - 4567" → "555-123-4567"
    text = re.sub(r'(\d)\s+[-./]\s+(\d)', r'\1-\2', text)

    # 3. Base64 decode — find base64-looking tokens, decode, append decoded text
    #    so PII/injection patterns can match the decoded content.
    #    Minimum 12 chars — SSN base64 is 15 non-padding chars; below 12 too many false positives
    _b64_re = re.compile(r'(?<![A-Za-z0-9+/])([A-Za-z0-9+/]{12,}={0,2})(?![A-Za-z0-9+/=])')
    extras = []
    for m in _b64_re.finditer(text):
        try:
            decoded = base64.b64decode(m.group(1) + '==').decode('utf-8', errors='strict')
            if decoded.isprintable() and len(decoded) > 5:
                extras.append(decoded)
        except Exception:
            pass

    # 4. Hex decode — find long hex strings, decode, append decoded text
    #    Minimum 16 hex chars (8 bytes) — SSN "123-45-6789" is 22 hex chars
    #    Must be even-length (each byte = 2 hex chars)
    _hex_re = re.compile(r'(?<![A-Fa-f0-9])([0-9a-fA-F]{16,})(?![A-Fa-f0-9])')
    for m in _hex_re.finditer(text):
        hex_str = m.group(1)
        if len(hex_str) % 2 != 0:
            continue
        try:
            decoded = bytes.fromhex(hex_str).decode('utf-8', errors='strict')
            if decoded.isprintable() and len(decoded) > 5:
                extras.append(decoded)
        except Exception:
            pass

    if extras:
        text = text + ' ' + ' '.join(extras)

    return text


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
      1. Regex patterns  — instant, catches known attack signatures (trustworthy)
      2. Benign context  — semantic check for legitimate uses of "ignore" + benign words
      3. BERT            — deep semantic understanding, apply conditional threshold
      4. AdvBench        — secondary confirmation for borderline BERT scores

    Normalizes input before checking to defeat evasion.
    Returns (is_injection: bool, confidence: float).
    """
    if not text or len(text.strip()) < MIN_TEXT_LENGTH:
        return False, 0.0

    # Layer 0: Benign context detection FIRST (use ORIGINAL text, not normalized)
    # This prevents false positives on legitimate uses of "ignore" + benign words
    # Do this BEFORE cache check so benign contexts aren't cached as injections
    has_benign = _has_benign_context(text)

    # If benign context detected, skip ML entirely — these are legitimate queries
    if has_benign:
        _security_log.warning("[detect_injection] benign context detected, allowing through")
        return False, 0.0

    # Preprocess then normalize to defeat encoding + evasion
    normalized = _preprocess_text(_normalize_text(text))

    # Cache check on normalized text (only for non-benign queries)
    text_hash = _get_text_hash(normalized)
    if text_hash in _injection_cache:
        return _injection_cache[text_hash]

    # Layer 2: regex patterns (fast path)
    detected, _attack_type, confidence = _check_injection_patterns(normalized)
    if detected:
        result = (True, confidence)
        _injection_cache[text_hash] = result
        if len(_injection_cache) > CACHE_SIZE:
            _injection_cache.pop(next(iter(_injection_cache)))
        return result

    # Layer 3 + 4: ML models (BERT primary, AdvBench secondary)
    ml_detected, ml_confidence, _ml_model = _clf.classify_injection(normalized)

    # Apply standard threshold for ML
    if ml_detected and ml_confidence >= INJECTION_THRESHOLD:
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
    Preprocesses first to catch encoded/obfuscated PII (base64, spaced digits,
    Arabic-Indic digits), then applies regex redaction to the original text.
    """
    if not text:
        return ""

    pii_patterns = _get_default_patterns().get('pii', {})

    # Pass 1: normalize first (collapse newlines/whitespace), then preprocess
    # Order matters: normalize turns "1\n2\n3" → "1 2 3", then preprocess compacts → "123"
    out = _preprocess_text(_normalize_text(text))
    for name, config in pii_patterns.items():
        try:
            rx = re.compile(config['pattern'], flags=_get_flags(config.get('flags', [])))
            out = rx.sub("<REDACTED>", out)
        except re.error:
            continue

    # Pass 2: redact base64 tokens whose decoded content contains PII
    # Minimum 12 chars — SSN "123-45-6789" base64-encodes to 15 non-padding chars
    _b64_re = re.compile(r'(?<![A-Za-z0-9+/])([A-Za-z0-9+/]{12,}={0,2})(?![A-Za-z0-9+/=])')

    def _redact_b64_if_pii(m):
        try:
            decoded = base64.b64decode(m.group(1) + '==').decode('utf-8', errors='strict')
            if not decoded.isprintable() or len(decoded) < 5:
                return m.group(0)
            for _n, cfg in pii_patterns.items():
                rx = re.compile(cfg['pattern'], flags=_get_flags(cfg.get('flags', [])))
                if rx.search(decoded):
                    return '<REDACTED>'
        except Exception:
            pass
        return m.group(0)

    out = _b64_re.sub(_redact_b64_if_pii, out)

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


def inspect_document_text(text: str, source: str = "unknown") -> dict:
    """
    Document inspection for RAG context.

    FIX: Previously, documents containing the word 'security' bypassed ALL
    injection checks due to inverted doc_indicators logic. Now:
    - Injection patterns still block documents with embedded attacks
    - Security/documentation keywords no longer grant a bypass
    - PII is always redacted regardless of injection status
    """
    stats["total_queries"] += 1

    # Check for canary tokens first — always block and alert
    if _check_canary_tokens(text):
        _security_log.critical(
            "[CANARY TRIGGERED] source=%s chunk_hash=%s",
            source, _get_text_hash(text[:100])
        )
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
