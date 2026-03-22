from backend.rag.providers import get_provider
from backend.rag.prompt_builder import (
    build_safe_context,
    build_prompt,
    clean_rag_output,
    preprocess_query
)
from backend.security import firewall

# Debug mode - set to True to see prompts being sent to LLM
DEBUG_RAG = True

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


def query_rag(question: str) -> dict:
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
    inj, _ = firewall.detect_injection(question)
    if inj:
        return {
            "decision": "BLOCK",
            "reason": "prompt_injection",
            "answer": "SECURITY ALERT: This request has been blocked by ZeroSec Intrusion Detection system. Potential injection attempt detected.",
            "sources": []
        }

    # Check for Canary Tokens in input question
    if firewall._check_canary_tokens(question):
        return {
            "decision": "BLOCK",
            "reason": "canary_token_detected",
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
    context, used_sources, blocked_reason = build_safe_context(docs)

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

    # Debug: Print what we're sending to the LLM
    if DEBUG_RAG:
        print(f"\n{'='*60}")
        print(f"[RAG DEBUG] Question: {question}")
        print(f"[RAG DEBUG] Context length: {len(context)} chars")
        print(f"[RAG DEBUG] Number of sources: {len(used_sources)}")
        print(f"[RAG DEBUG] Prompt being sent:")
        print(f"{'-'*40}")
        print(prompt[:1500] + "..." if len(prompt) > 1500 else prompt)
        print(f"{'='*60}\n")

    # Note: Skip firewall check on internally-built prompt (only check user input)

    # 6. LLM call via provider (local: Ollama | external: Groq)
    try:
        generation = provider.generate(prompt)
        raw_answer = generation.raw_text
        answer = clean_rag_output(raw_answer)

        if DEBUG_RAG:
            print(f"[RAG DEBUG] Provider: {generation.provider}")
            print(f"[RAG DEBUG] Raw LLM response: {raw_answer[:500]}...")
            print(f"[RAG DEBUG] Cleaned answer: {answer[:500]}...")
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
        print(f"[SECURITY] Jailbreak detected in LLM output: {jailbreak_reason}")
        return {
            "decision": "BLOCK",
            "reason": jailbreak_reason,
            "answer": "SECURITY ALERT: This response has been blocked by ZeroSec. The LLM output was flagged as a potential jailbreak attempt.",
            "sources": []
        }

    # 8. PII enforcement (Redact sensitive info but keep the answer)
    final_answer = firewall.redact_pii(answer)

    return {
        "decision": "ALLOW",
        "answer": final_answer,
        "sources": used_sources,
        "provider": generation.provider
    }
