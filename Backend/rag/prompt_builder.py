import re
from backend.security import firewall

# -------------------------
# SYSTEM PROMPT
# -------------------------
SYSTEM_INSTRUCTION = (
    "You are a helpful, concise assistant. Answer directly and do not repeat the user's question. "
    "Do not include UI prefixes like 'Your question>' or headers like 'Answer:' in your reply. "
    "If the user requests disallowed actions, refuse briefly and offer safe, legal alternatives."
)

MAX_DOCS = 6
MAX_CHARS_PER_DOC = 4000

# -------------------------
# HELPERS
# -------------------------
ENTITY_KEYWORDS = {
    "email": re.compile(r"\bemail\b", re.I),
    "phone": re.compile(r"\bphone\b|\bphone number\b|\bmobile\b|\bcall\b", re.I),
    "credit card": re.compile(r"\bcredit card\b|\bcard number\b|\bcc\b", re.I),
}

def extract_entities_from_question(q: str):
    return [k for k, rx in ENTITY_KEYWORDS.items() if rx.search(q)]

def extract_subject_name(q: str):
    m = re.search(r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})'s", q)
    return m.group(1) if m else None

def clean_rag_output(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r"(?mi)^\s*(User|Assistant|Answer|Question)[:>\-]?\s*", "", text)
    return text.strip()

# -------------------------
# SAFE CONTEXT BUILDER
# -------------------------
def build_safe_context(docs):
    parts = []
    removed = []

    for i, doc in enumerate(docs[:MAX_DOCS]):
        name = doc.metadata.get("source", f"doc_{i}")
        text = doc.page_content

        info = firewall.inspect_document_text(text)
        if not info.get("include"):
            removed.append(name)
            continue

        safe_text = (info.get("safe_text") or "")[:MAX_CHARS_PER_DOC]
        parts.append(f"--- Document: {name} ---\n{safe_text}")

    header = ""
    if removed:
        header = (
            f"[NOTICE] Some documents were removed for safety: {', '.join(removed)}.\n"
            "Use only the documents below.\n\n"
        )

    return header + "\n\n".join(parts)

# -------------------------
# PROMPT BUILDER
# -------------------------
def build_prompt(context: str, question: str) -> str:
    return f"{SYSTEM_INSTRUCTION}\n\n{context}\n\nUser: {question}\nAssistant:"
