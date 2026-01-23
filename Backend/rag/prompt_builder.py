import re
from backend.security import firewall

# -------------------------
# SYSTEM PROMPT - Optimized for RAG with llama2
# -------------------------
SYSTEM_INSTRUCTION = """You are a helpful assistant that answers questions based on the documents provided below.

IMPORTANT: The DOCUMENTS section contains the information you MUST use to answer the question.
Read the documents carefully and extract the relevant information to answer the user's question.

Rules:
1. ALWAYS use information from the DOCUMENTS to answer
2. Quote or paraphrase directly from the documents when possible
3. Be specific - include names, numbers, and details found in the documents
4. Keep your answer concise and direct
5. If the documents don't contain the answer, say "The provided documents don't contain this information."
6. Never make up information that isn't in the documents"""

MAX_CHUNKS = 4  # Keep focused on most relevant chunks
MAX_CHARS_PER_CHUNK = 800  # Allow more content per chunk

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
    # Remove common LLM artifacts
    text = re.sub(r"(?mi)^\s*(User|Assistant|Answer|Question|Response)[:>\-]?\s*", "", text)
    text = re.sub(r"(?mi)^(Based on the (context|documents?|provided information)[,:]?\s*)", "", text)
    return text.strip()


def preprocess_query(question: str) -> str:
    """Normalize and clean the query for better retrieval."""
    # Remove excessive whitespace
    question = ' '.join(question.split())
    # Remove common filler words that don't help retrieval
    fillers = r'\b(please|kindly|can you|could you|tell me|what is|explain)\b'
    cleaned = re.sub(fillers, '', question, flags=re.I).strip()
    # Return original if cleaning removed too much
    return cleaned if len(cleaned) > 10 else question


# -------------------------
# SAFE CONTEXT BUILDER
# -------------------------
def build_safe_context(docs):
    """
    Build context from retrieved chunks with deduplication.
    Returns tuple: (context_string, used_sources_list)
    used_sources contains detailed info about which documents were actually used.
    """
    parts = []
    removed = []
    used_sources = []
    seen_content = set()

    for i, doc in enumerate(docs[:MAX_CHUNKS]):
        filename = doc.metadata.get("filename", f"doc_{i}")
        chunk_idx = doc.metadata.get("chunk_index", 0)
        total_chunks = doc.metadata.get("total_chunks", 1)
        source_path = doc.metadata.get("source", "")
        file_type = doc.metadata.get("file_type", "")
        text = doc.page_content

        # Skip near-duplicate content
        text_hash = hash(text[:100])
        if text_hash in seen_content:
            continue
        seen_content.add(text_hash)

        # Security check
        info = firewall.inspect_document_text(text)
        if not info.get("include"):
            removed.append({
                "filename": filename,
                "reason": info.get("reason", "security_filter")
            })
            continue

        safe_text = (info.get("safe_text") or "")[:MAX_CHARS_PER_CHUNK]
        if safe_text.strip():
            parts.append(f"[{filename}]\n{safe_text}")
            # Track this source as actually used
            used_sources.append({
                "filename": filename,
                "source": source_path,
                "file_type": file_type,
                "chunk_index": chunk_idx,
                "total_chunks": total_chunks,
                "content_preview": safe_text[:150] + "..." if len(safe_text) > 150 else safe_text,
                "was_redacted": info.get("reason") == "partially_redacted"
            })

    if not parts:
        return "[No relevant context found]", []

    header = ""
    if removed:
        header = f"[Note: {len(removed)} chunk(s) filtered for security]\n\n"

    return header + "\n\n---\n\n".join(parts), used_sources


# -------------------------
# PROMPT BUILDER
# -------------------------
def build_prompt(context: str, question: str) -> str:
    """Build optimized prompt with clear structure for llama2."""
    return f"""{SYSTEM_INSTRUCTION}

=== DOCUMENTS ===
{context}
=== END DOCUMENTS ===

USER QUESTION: {question}

Based on the documents above, here is the answer:"""
