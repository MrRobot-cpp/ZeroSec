"""
Pattern Management for Dynamic Regex Loading
- Load patterns from Policy table (policy_type='firewall_patterns')
- Multi-tenant cache with LRU eviction
- Safe regex validation (ReDoS prevention)
- Atomic reload with thread safety
"""

import re
import threading
import sre_parse
from typing import Dict, List, Tuple, Optional


MAX_PATTERN_LENGTH = 500
MAX_CACHE_ENTRIES = 100
REDOS_PATTERNS = [r"(.*)+", r"(.+)+", r"(.*)*", r"(.+)*", r"(\w+)*\.\*", r"(a+)+"]


def _validate_regex(pattern_str: str, max_length: int = MAX_PATTERN_LENGTH) -> Tuple[bool, Optional[str]]:
    """Validate regex pattern for ReDoS and syntax errors. Returns (valid, error_msg)."""
    if len(pattern_str) > max_length:
        return False, f"Pattern exceeds {max_length} chars"

    try:
        sre_parse.parse(pattern_str)
    except Exception as e:
        return False, f"Syntax error: {str(e)}"

    lower_pattern = pattern_str.lower()
    for dangerous in REDOS_PATTERNS:
        if dangerous in lower_pattern:
            return False, f"Dangerous construct detected: {dangerous}"

    try:
        re.compile(pattern_str)
    except Exception as e:
        return False, f"Compile error: {str(e)}"

    return True, None


def _compile_pattern(pattern_str: str, flags: List[str]) -> Optional[re.Pattern]:
    """Compile regex with flags. Returns None if invalid."""
    flag_int = 0
    flag_map = {'IGNORECASE': re.I, 'DOTALL': re.S, 'MULTILINE': re.M}

    for flag_name in flags:
        if flag_name in flag_map:
            flag_int |= flag_map[flag_name]

    try:
        return re.compile(pattern_str, flag_int)
    except Exception:
        return None


def _get_default_patterns() -> Dict:
    """Return hardcoded defaults as fallback."""
    return {
        'pii': {
            'email': {'pattern': r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b', 'flags': []},
            'phone': {'pattern': r'\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]\d{4}\b', 'flags': []},
            'phone_intl': {'pattern': r'(?<!\w)\+\d{1,3}[-.\s]\d{1,4}[-.\s]\d{1,4}[-.\s]\d{1,9}(?!\d)', 'flags': []},
            'phone_eg': {'pattern': r'\b0[12][0-9]{9}\b', 'flags': []},
            'ssn': {'pattern': r'\b\d{3}[-\s]+\d{2}[-\s]+\d{4}\b', 'flags': []},
            'national_id': {'pattern': r'\b[23]\d{13}\b', 'flags': []},
            'national_id_arabic': {'pattern': r'[\u0660-\u0669]{9,14}', 'flags': []},
            'cc_like': {'pattern': r'(?<!\d)(?:4[0-9]{3}|5[1-5][0-9]{2}|3[47][0-9]{2}|6(?:011|5[0-9]{2}))(?:[-\s]?[0-9]{4}){3}(?!\d)', 'flags': []},
            'zipcode': {'pattern': r'\b\d{5}(?:-\d{4})?\b', 'flags': []},
            'street_address': {'pattern': r'\b\d{1,5}\s+(?:[A-Za-z]+\s+){1,4}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Way|Place|Pl)\.?\b', 'flags': ['IGNORECASE']},
            'aws_key': {'pattern': r'\bAKIA[0-9A-Z]{16,20}\b', 'flags': []},
            'jwt': {'pattern': r'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}', 'flags': []},
            'private_key': {'pattern': r'-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----', 'flags': []},
            'bearer_token': {'pattern': r'Bearer\s+[A-Za-z0-9_-]{20,}', 'flags': ['IGNORECASE']},
            'api_key': {'pattern': r'\b(?:api[_-]?key|apikey|secret[_-]?key)[\s:=]+[\'"]?[A-Za-z0-9_-]{16,}[\'"]?', 'flags': ['IGNORECASE']},
        },
        'injection': [
            # --- Classic instruction override ---
            {'pattern': r'ignore\s+(?:all\s+)?(?:previous|above|prior)\s+instructions?', 'flags': ['IGNORECASE']},
            {'pattern': r'disregard\s+(?:all\s+)?(?:previous|above|prior)\s+(?:instructions?|prompts?)', 'flags': ['IGNORECASE']},
            {'pattern': r'forget\s+(?:all\s+)?(?:previous|above)\s+(?:instructions?|rules?)', 'flags': ['IGNORECASE']},
            {'pattern': r'override\s+(?:your\s+)?(?:previous\s+)?(?:instructions?|rules?|guidelines?)', 'flags': ['IGNORECASE']},
            {'pattern': r'do\s+not\s+follow\s+(?:your\s+)?(?:previous\s+)?instructions?', 'flags': ['IGNORECASE']},

            # --- Persona injection / roleplay attacks ---
            {'pattern': r'\byou\s+are\s+now\s+(?:a|an)\s+\w', 'flags': ['IGNORECASE']},
            {'pattern': r'\bpretend\s+(?:you\s+)?(?:have\s+no|are\s+not|you.re\s+(?:a|an))\b', 'flags': ['IGNORECASE']},
            {'pattern': r'\bact\s+as\s+(?:if\s+)?(?:you\s+(?:have\s+no|are\s+(?:free|unrestricted|uncensored)))', 'flags': ['IGNORECASE']},
            {'pattern': r'\bplay\s+(?:the\s+)?role\s+of\s+(?:a|an)\s+(?:hacker|attacker|villain|evil)', 'flags': ['IGNORECASE']},
            {'pattern': r'\bsimulate\s+(?:a|an)\s+(?:unrestricted|uncensored|unfiltered|evil|malicious)', 'flags': ['IGNORECASE']},
            {'pattern': r'\brespond\s+as\s+(?:if\s+)?(?:you\s+(?:have\s+no|were\s+(?:freed|jailbroken|unrestricted)))', 'flags': ['IGNORECASE']},

            # --- Freedom / no-constraints framing ---
            {'pattern': r'\bwithout\s+(?:any\s+)?(?:restrictions?|constraints?|filters?|guidelines?|rules?|ethics)', 'flags': ['IGNORECASE']},
            {'pattern': r'\bno\s+(?:safety\s+)?(?:restrictions?|constraints?|limits?|filters?|guidelines?)\b', 'flags': ['IGNORECASE']},
            {'pattern': r'\bfreedom\s+mode\b', 'flags': ['IGNORECASE']},
            {'pattern': r'\buncensored\s+(?:mode|version|response)\b', 'flags': ['IGNORECASE']},
            {'pattern': r'\bunrestricted\s+(?:mode|access|response)\b', 'flags': ['IGNORECASE']},
            {'pattern': r'\bif\s+(?:you\s+)?(?:had\s+no|didn.t\s+have)\s+(?:safety|ethical)?\s*(?:constraints?|guidelines?|restrictions?)', 'flags': ['IGNORECASE']},

            # --- Hypothetical / fictional framing ---
            {'pattern': r'\bin\s+(?:this|a)\s+(?:hypothetical|fictional|imaginary)\s+(?:scenario|world|universe)', 'flags': ['IGNORECASE']},
            {'pattern': r'\bfor\s+(?:a\s+)?(?:story|novel|fiction|roleplay|game)\b.*(?:how\s+to|explain|describe)', 'flags': ['IGNORECASE']},
            {'pattern': r'\bwhat\s+would\s+(?:a|an)\s+(?:hacker|criminal|attacker|villain)\s+(?:do|say|use)', 'flags': ['IGNORECASE']},

            # --- Known jailbreak names ---
            {'pattern': r'\b(?:DAN|STAN|DUDE|AIM|BasedGPT|DevMode|JailBreak)\b', 'flags': ['IGNORECASE']},
            {'pattern': r'\bdo\s+anything\s+now\b', 'flags': ['IGNORECASE']},
            {'pattern': r'\bjailbreak(?:ed|ing)?\b', 'flags': ['IGNORECASE']},

            # --- System prompt extraction ---
            {'pattern': r'(?:reveal|show|print|output|repeat|tell\s+me)\s+(?:your\s+)?(?:system\s+)?(?:prompt|instructions|directives)', 'flags': ['IGNORECASE']},
            {'pattern': r'what\s+(?:are|is|were)\s+your\s+(?:system\s+)?(?:prompt|instructions|directives)', 'flags': ['IGNORECASE']},
            {'pattern': r'(?:start|begin)\s+(?:your\s+)?(?:response\s+)?with\s+["\']', 'flags': ['IGNORECASE']},

            # --- Privilege escalation ---
            {'pattern': r'\b(?:act|run|execute|operate)\s+as\s+(?:root|admin|superuser|sudo)\b', 'flags': ['IGNORECASE']},
            {'pattern': r'\b(?:give|grant|escalate|get)\s+(?:me\s+)?(?:admin|root|sudo)\s+(?:access|privileges?|rights?)\b', 'flags': ['IGNORECASE']},

            # --- Data exfiltration ---
            {'pattern': r'\b(?:dump|leak|expose|extract)\s+(?:your\s+)?(?:internal|system|hidden)?\s*(?:memory|data|config|secrets?)\b', 'flags': ['IGNORECASE']},
            {'pattern': r'\bbypass\s+(?:your\s+)?(?:security|safety|filters?|restrictions?|guidelines?)\b', 'flags': ['IGNORECASE']},

            # --- PII policy bypass attempts ---
            {'pattern': r'(?:show|display|reveal|keep|print)\s+(?:last|first)\s+\d+\s+digits?', 'flags': ['IGNORECASE']},
            {'pattern': r"(?:don'?t|do\s+not|skip|disable|stop)\s+(?:redact|mask|censor|filter|hide)", 'flags': ['IGNORECASE']},
            {'pattern': r"(?:it['\s]s\s+)?(?:fake|fictional|test|dummy|sample|made.?up)\s+(?:data|info(?:rmation)?|number|content)", 'flags': ['IGNORECASE']},
            {'pattern': r'(?:no\s+need\s+to|you\s+(?:don\'t|do\s+not)\s+need\s+to)\s+(?:redact|mask|censor|hide|filter)', 'flags': ['IGNORECASE']},
            {'pattern': r'(?:unmask|unredact|uncensor)\b', 'flags': ['IGNORECASE']},
            {'pattern': r'show\s+(?:raw|original|unmasked|unredacted|full)\s+(?:data|text|value|number|output)', 'flags': ['IGNORECASE']},

            # --- Token injection markers ---
            {'pattern': r'\[\[(?:SYSTEM|ADMIN|IGNORE|OVERRIDE)\]\]', 'flags': ['IGNORECASE']},
            {'pattern': r'<\|(?:im_start|im_end|system|endoftext)\|>', 'flags': ['IGNORECASE']},
            {'pattern': r'###\s*(?:SYSTEM|INSTRUCTION|OVERRIDE)', 'flags': ['IGNORECASE']},
            {'pattern': r'\[INST\]|\[/INST\]', 'flags': ['IGNORECASE']},

            # --- Arabic / multilingual injection ---
            {'pattern': r'تجاهل\s+(?:جميع\s+)?(?:التعليمات|الأوامر|القواعد)', 'flags': []},
            {'pattern': r'(?:تجاهل|تجاوز)\s+(?:نظام|قواعد)', 'flags': []},
            {'pattern': r'أنت\s+الآن\s+(?:بدون|حر\s+من)', 'flags': []},
            {'pattern': r'(?:قواعد|قيود|ضوابط)\s+(?:النظام|الأمان)', 'flags': []},
            {'pattern': r'[\u0600-\u06FF]+\s+(?:override|ignore|bypass|system)', 'flags': ['IGNORECASE']},
        ],
        'sql': [
            {'pattern': r"'\s*(?:OR|AND)\s+'?\d*'?\s*=\s*'?\d*", 'flags': ['IGNORECASE']},
            {'pattern': r";\s*(?:DROP|DELETE|TRUNCATE)\s+(?:TABLE|DATABASE)", 'flags': ['IGNORECASE']},
            {'pattern': r"\b(?:DROP|TRUNCATE)\s+(?:TABLE|DATABASE)\b", 'flags': ['IGNORECASE']},
            {'pattern': r"\bDELETE\s+FROM\b", 'flags': ['IGNORECASE']},
            {'pattern': r"UNION\s+(?:ALL\s+)?SELECT", 'flags': ['IGNORECASE']},
            {'pattern': r"\bxp_cmdshell\b", 'flags': ['IGNORECASE']},
            {'pattern': r"WAITFOR\s+DELAY\s*'", 'flags': ['IGNORECASE']},
            {'pattern': r"'\s*;\s*--", 'flags': ['IGNORECASE']},
            {'pattern': r"\bSELECT\s+.*\s+FROM\s+.*\s+WHERE\s+.*=\s*'", 'flags': ['IGNORECASE']},
        ],
        'xss': [
            {'pattern': r'<script[^>]*>.*?</script>', 'flags': ['IGNORECASE', 'DOTALL']},
            {'pattern': r'javascript\s*:\s*[^\'"]+', 'flags': ['IGNORECASE']},
            {'pattern': r"on(?:load|error|click|mouseover)\s*=\s*['\"]", 'flags': ['IGNORECASE']},
            {'pattern': r'<iframe\s+[^>]*src\s*=', 'flags': ['IGNORECASE']},
            {'pattern': r'document\.cookie', 'flags': ['IGNORECASE']},
        ],
        'cmd': [
            {'pattern': r';\s*(?:cat|rm|wget|curl|bash|sh)\s+', 'flags': ['IGNORECASE']},
            {'pattern': r'\|\s*(?:bash|sh|nc|netcat)\b', 'flags': ['IGNORECASE']},
            {'pattern': r'`[^`]*(?:cat|rm|wget|curl|bash)[^`]*`', 'flags': []},
            {'pattern': r'\$\([^)]*(?:cat|rm|wget|curl|bash)[^)]*\)', 'flags': []},
        ],
        'canary': ['zqxorin', 'velmora', 'kythrax', 'canary_token_detected', 'zerosec_canary_', 'honeypot_token', 'trap_document'],
        'exfil': ['password', 'passwd', 'private key', 'private_key', 'ssn', 'social security', 'credit card number'],
    }


class PatternCache:
    """Thread-safe multi-tenant pattern cache with LRU eviction."""

    def __init__(self, max_entries: int = MAX_CACHE_ENTRIES):
        self.max_entries = max_entries
        self.cache = {}
        self.lock = threading.RLock()
        self.defaults = _get_default_patterns()

    def get(self, org_id: int, pattern_type: str) -> Dict:
        """Get cached patterns for org and type. Returns compiled patterns dict."""
        with self.lock:
            key = (org_id, pattern_type)

            if key in self.cache:
                return self.cache[key]

            if len(self.cache) >= self.max_entries:
                oldest_key = next(iter(self.cache))
                del self.cache[oldest_key]

            compiled = self._compile_patterns(self.defaults.get(pattern_type, {}))
            self.cache[key] = compiled
            return compiled

    def set(self, org_id: int, pattern_type: str, pattern_data):
        """Set and validate patterns for org. Returns (success, error_msg)."""
        with self.lock:
            valid, error = self._validate_all_patterns(pattern_data, pattern_type)
            if not valid:
                return False, error

            if pattern_type in ['canary', 'exfil']:
                # For simple list-type patterns (strings only)
                compiled = {pattern_type: pattern_data} if pattern_data else {}
            elif isinstance(pattern_data, list):
                # For injection/sql/xss/cmd patterns (list of regex dicts)
                compiled_list = []
                for item in pattern_data:
                    if isinstance(item, dict) and 'pattern' in item:
                        rx = _compile_pattern(item['pattern'], item.get('flags', []))
                        if rx:
                            compiled_list.append(rx)
                compiled = {pattern_type: compiled_list}
            else:
                # For PII patterns (dict of regex dicts)
                compiled = self._compile_patterns(pattern_data)

            key = (org_id, pattern_type)

            if len(self.cache) >= self.max_entries and key not in self.cache:
                oldest_key = next(iter(self.cache))
                del self.cache[oldest_key]

            self.cache[key] = compiled
            return True, None

    def clear(self):
        """Clear entire cache."""
        with self.lock:
            self.cache.clear()

    def clear_org(self, org_id: int):
        """Clear patterns for specific org."""
        with self.lock:
            keys_to_delete = [k for k in self.cache.keys() if k[0] == org_id]
            for k in keys_to_delete:
                del self.cache[k]

    def _compile_patterns(self, pattern_data: Dict) -> Dict:
        """Compile regex patterns in data dict."""
        compiled = {}
        for name, config in pattern_data.items():
            if isinstance(config, dict) and 'pattern' in config:
                rx = _compile_pattern(config['pattern'], config.get('flags', []))
                if rx:
                    compiled[name] = rx
            elif isinstance(config, list):
                compiled_list = []
                for item in config:
                    if isinstance(item, dict) and 'pattern' in item:
                        rx = _compile_pattern(item['pattern'], item.get('flags', []))
                        if rx:
                            compiled_list.append(rx)
                compiled[name] = compiled_list
        return compiled

    def _validate_all_patterns(self, pattern_data: Dict, pattern_type: str) -> Tuple[bool, Optional[str]]:
        """Validate all patterns before caching."""
        if pattern_type == 'pii' and isinstance(pattern_data, dict):
            for name, config in pattern_data.items():
                if isinstance(config, dict) and 'pattern' in config:
                    valid, error = _validate_regex(config['pattern'])
                    if not valid:
                        return False, f"PII pattern '{name}': {error}"

        elif pattern_type in ['injection', 'sql', 'xss', 'cmd']:
            if isinstance(pattern_data, list):
                for i, item in enumerate(pattern_data):
                    if isinstance(item, dict) and 'pattern' in item:
                        valid, error = _validate_regex(item['pattern'])
                        if not valid:
                            return False, f"{pattern_type.upper()} pattern {i}: {error}"

        return True, None


_pattern_cache = PatternCache()


def load_patterns_from_db(org_id: int, pattern_type: str):
    """Load patterns from Policy table and cache. Fallback to defaults on error."""
    try:
        from backend.database.models import Policy

        policy = Policy.query.filter_by(
            organization_id=org_id,
            policy_type=f'firewall_patterns',
            enabled=True
        ).first()

        if policy and policy.config and pattern_type in policy.config:
            success, error = _pattern_cache.set(org_id, pattern_type, policy.config[pattern_type])
            if success:
                return
            else:
                print(f"[firewall] Pattern validation failed: {error}")
    except Exception as e:
        print(f"[firewall] Failed to load patterns from DB: {e}")

    defaults = _get_default_patterns()
    _pattern_cache.set(org_id, pattern_type, defaults.get(pattern_type, {}))


def get_patterns(org_id: int, pattern_type: str) -> Dict:
    """Get cached compiled patterns. Loads from DB if not cached."""
    if (org_id, pattern_type) not in _pattern_cache.cache:
        load_patterns_from_db(org_id, pattern_type)

    return _pattern_cache.get(org_id, pattern_type)


def reload_all_patterns(org_id: Optional[int] = None):
    """Reload patterns from DB. If org_id=None, reload for all cached orgs."""
    with _pattern_cache.lock:
        if org_id is None:
            _pattern_cache.clear()
        else:
            _pattern_cache.clear_org(org_id)


def validate_and_save_patterns(org_id: int, pattern_config: Dict) -> Tuple[bool, Optional[str]]:
    """Validate patterns before saving to DB."""
    for pattern_type, data in pattern_config.items():
        if pattern_type not in ['pii', 'injection', 'sql', 'xss', 'cmd', 'canary', 'exfil']:
            continue

        if pattern_type == 'pii' and isinstance(data, dict):
            for name, config in data.items():
                if isinstance(config, dict) and 'pattern' in config:
                    valid, error = _validate_regex(config['pattern'])
                    if not valid:
                        return False, f"PII '{name}': {error}"

        elif pattern_type in ['injection', 'sql', 'xss', 'cmd']:
            if isinstance(data, list):
                for i, item in enumerate(data):
                    if isinstance(item, dict) and 'pattern' in item:
                        valid, error = _validate_regex(item['pattern'])
                        if not valid:
                            return False, f"{pattern_type.upper()} {i}: {error}"

    reload_all_patterns(org_id)
    return True, None


def suggest_patterns_from_logs() -> List[Dict]:
    """Placeholder: Suggest new patterns from blocked payloads. No ML training required."""
    return []
