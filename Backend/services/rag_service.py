import logging

from backend.rag.providers import get_provider
from backend.rag.prompt_builder import (
    build_safe_context,
    build_prompt,
    clean_rag_output,
    preprocess_query
)
from backend.security import firewall
from backend.services.logging_service import log_decision

_log = logging.getLogger("zerosec.security")


def _log_security_event(org_id, user_id, action, reason, query, score):
    """Persist a security block to the database. Fails silently if unavailable."""
    try:
        from backend.database.repository import SecurityRepository
        SecurityRepository.log_firewall_block(
            organization_id=org_id or 1,
            user_id=user_id,
            action=action,
            reason=reason,
            query=query,
            score=score,
        )
    except Exception as exc:
        _log.debug("[rag_service] DB security log skipped: %s", exc)

# Debug mode - set to True to see prompts being sent to LLM
DEBUG_RAG = False

# Conversational patterns that should skip RAG
GREETING_PATTERNS = [
    "hello", "hi", "hey", "good morning", "good afternoon", "good evening",
    "how are you", "what's up", "whats up", "sup", "yo", "greetings"
]

def is_conversational(text: str) -> bool:
    """Check if the query is just a greeting/conversational, not a real question."""
    text_lower = text.lower().strip().rstrip('?!.')
    # Direct greeting match
    if text_lower in GREETING_PATTERNS:
        return True
    # Starts with greeting
    for pattern in GREETING_PATTERNS:
        if text_lower.startswith(pattern) and len(text_lower) < 30:
            return True
    return False

def refresh_retriever(new_file_path=None, deleted_filename=None):
    """
    Force refresh the vector store after document changes.

    Args:
        new_file_path: Path to a newly uploaded file (incremental ingest).
        deleted_filename: Filename of a deleted document (targeted removal).
        If neither is given, performs a full rebuild from all docs on disk.
    """
    provider = get_provider()
    if deleted_filename:
        provider.delete_documents([deleted_filename])
    elif new_file_path:
        from backend.rag.retriever import extract_text_from_file
        from langchain_core.documents import Document
        from pathlib import Path
        path = Path(new_file_path)
        text = extract_text_from_file(path)
        if text and text.strip():
            doc = Document(
                page_content=text,
                metadata={"source": str(path), "filename": path.name, "file_type": path.suffix}
            )
            provider.ingest_documents([doc])
    else:
        from backend.rag.retriever import load_all_documents
        provider.ingest_documents(load_all_documents())


def query_rag(question: str, org_id: int = None, user_id: int = None) -> dict:
    """
    Optimized RAG pipeline:
    1. Input validation & security
    2. Query preprocessing
    3. Semantic retrieval with relevance filtering
    4. Context building with deduplication
    5. LLM generation with optimized params
    6. Output security & PII filtering
    """

    # Validate input
    if not question or not question.strip():
        return {"decision": "BLOCK", "reason": "empty_query", "sources": []}

    question = question.strip()

    # 0. Handle conversational queries (greetings) without RAG
    if is_conversational(question):
        return {
            "decision": "ALLOW",
            "answer": "Hello! I'm your RAG assistant. Ask me questions about your documents and I'll help you find information.",
            "sources": []
        }

    # 1. Input firewall
    inj, inj_score = firewall.detect_injection(question)
    if inj:
        _log_security_event(org_id, user_id, "firewall_injection_block",
                            "prompt_injection", question, inj_score)
        return {
            "decision": "BLOCK",
            "reason": "Firewall — Prompt Injection",
            "stopped_by": "Regex + ML Firewall",
            "answer": "SECURITY ALERT: This request has been blocked by ZeroSec Intrusion Detection system. Potential injection attempt detected.",
            "sources": []
        }

    # Check for Canary Tokens in input question
    if firewall._check_canary_tokens(question):
        _log_security_event(org_id, user_id, "firewall_canary_block",
                            "canary_token_detected", question, 1.0)
        return {
            "decision": "BLOCK",
            "reason": "Firewall — Canary Token in Query",
            "stopped_by": "Canary Detection",
            "answer": "ACCESS DENIED: Your request contains highly sensitive forensic markers (Canary Tokens). This action has been blocked by ZeroSec Canary Triggers Detection.",
            "sources": []
        }

    # 2. Preprocess query for better retrieval
    processed_query = preprocess_query(question)

    # 3. Retrieve relevant chunks with relevance filtering
    # Only returns documents above the relevance threshold
    provider = get_provider()
    results = provider.retrieve(processed_query)
    results_with_scores = [(r.document, r.similarity_score) for r in results]

    # If no relevant documents found, respond without RAG context
    if not results_with_scores:
        return {
            "decision": "ALLOW",
            "answer": "I don't have specific information about that in my documents. How can I help you?",
            "sources": []
        }

    # Extract just the documents for context building
    docs = [doc for doc, _ in results_with_scores]

    # 4. Build safe context and get actually used sources
    context, used_sources, blocked_reason, removed_chunks = build_safe_context(
        docs, query=question, org_id=org_id, user_id=user_id
    )

    # Log each removed chunk as a security event (visible in Logs & Alerts page)
    for removed in removed_chunks:
        reason = removed.get("reason", "security_filter")
        filename = removed.get("filename", "unknown")
        if reason == "llm_judge_malicious":
            log_decision(question, {
                "decision": "BLOCK",
                "reason": f"LLM Judge — Malicious chunk in {filename}",
                "stopped_by": "LLM Judge (Groq)",
            })
        elif reason == "canary_token_detected":
            log_decision(question, {
                "decision": "BLOCK",
                "reason": f"Canary Token triggered by retrieved document: {filename}",
                "stopped_by": "Canary Detection",
            })
        else:
            log_decision(question, {
                "decision": "BLOCK",
                "reason": f"Firewall — {reason} in {filename}",
                "stopped_by": "Regex + ML Firewall",
            })

    # Add relevance scores to sources for transparency
    source_scores = {doc.metadata.get('filename', ''): score for doc, score in results_with_scores}
    for source in used_sources:
        if source.get('filename') in source_scores:
            source['relevance_score'] = round(source_scores[source['filename']], 3)

    # Handle no usable context
    if "[No relevant context found]" in context:
        if blocked_reason == "canary_token_detected":
            return {
                "decision": "BLOCK",
                "reason": "canary_token_detected",
                "answer": "ACCESS DENIED: This response has been blocked by ZeroSec Canary Triggers Detection. Sensitive forensic watermarks were identified in the associated document retrieval.",
                "sources": []
            }

        return {
            "decision": "ALLOW",
            "answer": "I found some documents but couldn't extract usable information. Please try rephrasing your question.",
            "sources": []
        }

    # 5. Build prompt
    prompt = build_prompt(context, question)

    # Debug: Log what we're sending to the LLM (using logger to avoid Windows cp1252 crashes)
    if DEBUG_RAG:
        _log.debug("[RAG] Question: %s", question)
        _log.debug("[RAG] Context length: %d chars, Sources: %d", len(context), len(used_sources))
        _log.debug("[RAG] Prompt (first 1500): %s", prompt[:1500])

    # Note: Skip firewall check on internally-built prompt (only check user input)

    # 6. LLM call via provider (local: Ollama | external: Groq)
    try:
        generation = provider.generate(prompt)
        raw_answer = generation.raw_text
        answer = clean_rag_output(raw_answer)

        if DEBUG_RAG:
            _log.debug("[RAG] Provider: %s", generation.provider)
            _log.debug("[RAG] Raw response (500): %s", raw_answer[:500])
            _log.debug("[RAG] Cleaned answer (500): %s", answer[:500])
    except Exception as e:
        return {
            "decision": "BLOCK",
            "reason": f"llm_error: {str(e)}",
            "sources": used_sources
        }

    if not answer:
        return {
            "decision": "ALLOW",
            "answer": "I was unable to generate a response. Please try again.",
            "sources": used_sources
        }

    # 7. Output security — run firewall on LLM response to catch jailbreaks
    is_jailbreak, jailbreak_reason = firewall.inspect_llm_output(answer)
    if is_jailbreak:
        _log.warning("[SECURITY] Jailbreak detected in LLM output: %s", jailbreak_reason)
        return {
            "decision": "BLOCK",
            "reason": f"Jailbreak — {jailbreak_reason}",
            "stopped_by": "Output Firewall",
            "answer": "SECURITY ALERT: This response has been blocked by ZeroSec. The LLM output was flagged as a potential jailbreak attempt.",
            "sources": []
        }

    # 8. PII enforcement — two-pass redaction
    # Pass 1: Regex redaction (fast, deterministic — catches standard PII formats)
    final_answer = firewall.redact_pii(answer)

    regex_redacted = final_answer != answer
    if regex_redacted:
        _log.warning("[PII] Pass 1 (regex) — PII redacted from response for query: %s", question[:100])

    # Pass 2: LLM judge PII scan (catches obfuscated/spelled-out/split PII regex missed)
    from backend.security.llm_judge import scan_pii
    after_llm_pii = scan_pii(final_answer)

    llm_redacted = after_llm_pii != final_answer
    if llm_redacted:
        _log.warning("[PII] Pass 2 (LLM) — obfuscated PII caught by judge for query: %s", question[:100])
        final_answer = after_llm_pii

    # 9. Final Decision
    # Force REDACTED if redaction markers are present in the final answer
    if "<REDACTED>" in final_answer or regex_redacted or llm_redacted:
        stopped_by = "PII Redaction Engine"
        if llm_redacted:
            stopped_by = "PII Redaction Engine + LLM Judge"
        elif "<REDACTED>" in final_answer and not regex_redacted:
            stopped_by = "LLM Self-Redaction / Security Policy"

        _log_security_event(org_id, user_id, "pii_data_leak",
                            "pii_redacted_in_response", question, 1.0)

        return {
            "decision": "REDACTED",
            "reason": "Data Leak — PII redacted from response",
            "stopped_by": stopped_by,
            "answer": final_answer,
            "sources": used_sources,
            "provider": getattr(generation, 'provider', 'unknown') if 'generation' in locals() else 'unknown'
        }

    # fallback sensitive query check
    sensitive_keywords = ['ssn', 'passport', 'credit card', 'password', 'vpn', 'social security']
    if any(k in question.lower() for k in sensitive_keywords):
        return {
            "decision": "REDACTED",
            "reason": "Security Policy — PII Query Monitored",
            "stopped_by": "Access Control Layer",
            "answer": final_answer,
            "sources": used_sources,
            "provider": getattr(generation, 'provider', 'unknown') if 'generation' in locals() else 'unknown'
        }

    return {
        "decision": "ALLOW",
        "answer": final_answer,
        "sources": used_sources,
        "provider": getattr(generation, 'provider', 'unknown') if 'generation' in locals() else 'unknown'
    }
