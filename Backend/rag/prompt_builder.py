import re
from backend.security import firewall

# -------------------------
# SYSTEM PROMPT - Optimized for RAG with strong document grounding
# -------------------------
SYSTEM_INSTRUCTION = """You are a RAG assistant that answers questions ONLY using the documents provided below.

CRITICAL RULES:
1. Your answers MUST come from the DOCUMENTS section below - do not use external knowledge
2. Quote or cite specific text from the documents when answering
3. Include specific details: names, numbers, dates, and facts from the documents
4. If the documents don't contain the answer, say: "I don't have this information in my documents."
5. NEVER make up or infer information not explicitly stated in the documents
6. Keep answers concise and focused on what the user asked

You will be provided with document excerpts between the === DOCUMENTS === markers."""

MAX_CHUNKS = 4  # Increased from 3 for more context
MAX_CHARS_PER_CHUNK = 1000  # Increased from 800 for more complete excerpts

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
    # Only remove pure filler words that don't affect semantics
    fillers = r'\b(please|kindly|hi|hello|hey)\b'
    cleaned = re.sub(fillers, '', question, flags=re.I).strip()
    # Clean up double spaces
    cleaned = ' '.join(cleaned.split())
    # Return original if cleaning removed too much
    return cleaned if len(cleaned) > 5 else question


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
        blocked_reason = removed[0].get("reason") if removed else "no_relevant_context"
        return "[No relevant context found]", [], blocked_reason

    header = ""
    if removed:
        header = f"[Note: {len(removed)} chunk(s) filtered for security]\n\n"

    return header + "\n\n---\n\n".join(parts), used_sources, None


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