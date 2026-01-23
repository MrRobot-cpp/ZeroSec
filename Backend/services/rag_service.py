import ollama
from backend.rag.retriever import build_retriever, retrieve_with_scores, _ensure_vectorstore
from backend.rag.prompt_builder import (
    build_safe_context,
    build_prompt,
    extract_entities_from_question,
    extract_subject_name,
    clean_rag_output,
    preprocess_query
)
from backend.security import firewall

# -------------------------
# LLM CONFIG - Optimized for RAG
# -------------------------
LLM_MODEL = "llama2"
LLM_OPTIONS = {
    "temperature": 0.3,      # Slightly higher for better comprehension
    "top_p": 0.9,            # Nucleus sampling
    "top_k": 40,             # Limit token choices
    "num_predict": 256,      # Shorter responses for conciseness
    "repeat_penalty": 1.15,  # Reduce repetition
}

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

def refresh_retriever():
    """Force refresh retriever (call after document changes)."""
    _ensure_vectorstore(force_reload=True)


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
    inj, score = firewall.detect_injection(question)
    if inj:
        return {"decision": "BLOCK", "reason": "prompt_injection", "sources": []}

    # 2. Preprocess query for better retrieval
    processed_query = preprocess_query(question)

    # 3. Retrieve relevant chunks with relevance filtering
    # Only returns documents above the relevance threshold
    results_with_scores = retrieve_with_scores(processed_query)

    # If no relevant documents found, respond without RAG context
    if not results_with_scores:
        return {
            "decision": "ALLOW",
            "answer": "I don't have specific information about that in my documents. How can I help you?",
            "sources": []
        }

    # Extract just the documents for context building
    docs = [doc for doc, score in results_with_scores]

    # 4. Build safe context and get actually used sources
    context, used_sources = build_safe_context(docs)

    # Add relevance scores to sources for transparency
    source_scores = {doc.metadata.get('filename', ''): score for doc, score in results_with_scores}
    for source in used_sources:
        if source.get('filename') in source_scores:
            source['relevance_score'] = round(source_scores[source['filename']], 3)

    # Handle no usable context
    if "[No relevant context found]" in context:
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

    # 6. LLM call with optimized parameters
    try:
        response = ollama.generate(
            model=LLM_MODEL,
            prompt=prompt,
            options=LLM_OPTIONS
        )
        raw_answer = response.get("response", "")
        answer = clean_rag_output(raw_answer)

        if DEBUG_RAG:
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

    # 7. PII enforcement
    entities = extract_entities_from_question(question)
    subject = extract_subject_name(question)

    if entities and subject:
        return {
            "decision": "ALLOW",
            "answer": f"{subject}'s {entities[0]} is <REDACTED>",
            "sources": used_sources
        }

    return {
        "decision": "ALLOW",
        "answer": firewall.sanitize_text(answer),
        "sources": used_sources
    }
