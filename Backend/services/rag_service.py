import ollama
from backend.rag.retriever import build_retriever
from backend.rag.prompt_builder import (
    build_safe_context,
    build_prompt,
    extract_entities_from_question,
    extract_subject_name,
    clean_rag_output
)
from backend.security import firewall

LLM_MODEL = "llama2"

def query_rag(question: str) -> dict:
    # 1. Query firewall
    inj, score = firewall.detect_injection(question)
    if inj:
        return {"decision": "BLOCK", "reason": "prompt_injection"}

    # 2. Rebuild retriever dynamically (checks for new files)
    retriever = build_retriever()

    # 3. Retrieve docs
    docs = retriever.invoke(question)

    # 4. Build context + prompt
    context = build_safe_context(docs)
    prompt = build_prompt(context, question)

    # 5. Prompt firewall
    inj, score = firewall.detect_injection(prompt)
    if inj:
        return {"decision": "BLOCK", "reason": "prompt_injection_prompt"}

    # 6. LLM call
    response = ollama.generate(model=LLM_MODEL, prompt=prompt)
    answer = clean_rag_output(response["response"])

    # 7. Output firewall
    inj, score = firewall.detect_injection(answer)
    if inj:
        return {"decision": "BLOCK", "reason": "prompt_injection_output"}

    # 8. PII enforcement
    entities = extract_entities_from_question(question)
    subject = extract_subject_name(question)

    if entities:
        return {
            "decision": "ALLOW",
            "answer": f"{subject}'s {entities[0]} is <REDACTED>"
        }

    return {"decision": "ALLOW", "answer": firewall.sanitize_text(answer)}
