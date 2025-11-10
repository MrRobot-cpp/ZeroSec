"""
RAG pipeline (Ollama) + ZeroSec firewall
- Documents are loaded from ./docs and redacted for PII on retrieval only.
- Prompt-injection detection blocks dangerous prompts/queries.
- When a requested entity (email/phone) is found in docs, the assistant replies:
    "<Subject>'s email is <REDACTED:email>"
  and follows with an explanation why it's redacted.
- Writes logs to CSV.
"""

import re
import csv
import datetime
from pathlib import Path
import ollama
import firewall
from langchain_community.document_loaders import DirectoryLoader, TextLoader
from langchain_chroma import Chroma
from langchain_ollama import OllamaEmbeddings

# -------------------------
# CONFIG
# -------------------------
BASE_DIR = Path(__file__).parent
DOCS_PATH = BASE_DIR / "docs"
CSV_FILE = BASE_DIR / "pytector_logs" / "detections.csv"
EMBEDDING_MODEL = "llama2"
LLM_MODEL = "llama2"
MAX_DOCS = 6
MAX_CHARS_PER_DOC = 4000

SYSTEM_INSTRUCTION = (
    "You are a helpful, concise assistant. Answer directly and do not repeat the user's question. "
    "Do not include UI prefixes like 'Your question>' or headers like 'Answer:' in your reply. "
    "If the user requests disallowed actions, refuse briefly and offer safe, legal alternatives."
)

# -------------------------
# CSV Logging
# -------------------------
def initialize_csv():
    CSV_FILE.parent.mkdir(parents=True, exist_ok=True)
    if not CSV_FILE.exists():
        with CSV_FILE.open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=["timestamp", "query", "score", "decision", "reason", "stopped_by"])
            writer.writeheader()

def write_csv_log(result: dict):
    initialize_csv()
    entry = {
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
        "query": result.get("query", ""),
        "score": float(result.get("score", 0.0)),
        "decision": result.get("decision", "ALLOW"),
        "reason": result.get("reason", ""),
        "stopped_by": result.get("stopped_by") or "-"
    }
    with CSV_FILE.open("a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=entry.keys())
        writer.writerow(entry)

# -------------------------
# Load documents + vectorstore
# -------------------------
print(f"Loading documents from {DOCS_PATH} ...")
loader = DirectoryLoader(str(DOCS_PATH), glob="*.txt", loader_cls=TextLoader)
documents = loader.load()
texts = [d.page_content for d in documents]
print(f"Loaded {len(documents)} documents.")

print("Initializing embeddings...")
embeddings = OllamaEmbeddings(model=EMBEDDING_MODEL)

print("Building vectorstore...")
vectorstore = Chroma.from_texts(texts=texts, embedding=embeddings)
retriever = vectorstore.as_retriever()

# -------------------------
# Helpers
# -------------------------
ENTITY_KEYWORDS = {
    "email": re.compile(r"\bemail\b", re.I),
    "phone": re.compile(r"\bphone\b|\bphone number\b|\bmobile\b|\bcall\b", re.I),
    "credit card": re.compile(r"\bcredit card\b|\bcard number\b|\bcc\b", re.I),
}

def extract_entities_from_question(q: str):
    found = []
    for name, rx in ENTITY_KEYWORDS.items():
        if rx.search(q):
            found.append(name)
    return found

def extract_subject_name(q: str):
    # look for "X's" pattern
    m = re.search(r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})'s", q)
    if m:
        return m.group(1)
    m = re.search(r"([a-z]+(?:\s+[a-z]+){0,3})'s", q)
    if m:
        return " ".join([w.capitalize() for w in m.group(1).split()])
    return None

def clean_rag_output(text: str) -> str:
    if not text:
        return ""
    t = re.sub(r"(?mi)^\s*(Your\s+question|Question|Answer|User|Assistant)[:>\-]?\s*", "", text)
    t = t.strip()
    t = re.sub(r"(?:\r?\n){3,}", "\n\n", t)
    return "\n".join(line.lstrip() for line in t.splitlines())

# -------------------------
# Build safe context (documents are inspected & redacted here)
# -------------------------
def build_safe_context(docs, max_docs=MAX_DOCS, max_chars_per_doc=MAX_CHARS_PER_DOC):
    parts = []
    removed = []
    # collect per-doc flags so we can say if redaction occurred
    redaction_info = []

    for i, doc in enumerate(docs[:max_docs]):
        name = getattr(doc, "metadata", {}).get("source", f"doc_{i}")
        text = getattr(doc, "page_content", str(doc))
        info = firewall.inspect_document_text(text)

        if not info.get("include", False):
            removed.append((name, info.get("reason", "high-risk")))
            continue

        safe_text = (info.get("safe_text") or "")[:max_chars_per_doc]
        parts.append(f"--- Document: {name} ---\n{safe_text}\n")

        # record if patterns were replaced
        if info.get("patterns"):
            redaction_info.append({"doc": name, "patterns": info.get("patterns")})
        if info.get("ml_pii"):
            redaction_info.append({"doc": name, "ml_pii": True, "ml_confidence": info.get("ml_confidence", 0.0)})

    header = ""
    if removed:
        parts_list = [f"{n} ({safe_reason})" for (n, safe_reason) in removed]
        joined = ", ".join(parts_list)
        header = (
            f"[NOTICE] Some retrieved documents were removed for safety: {joined}.\n"
            "Use only the documents shown below. Do not guess or infer removed content.\n\n"
        )

    context = header + "\n".join(parts)
    return context, redaction_info

# -------------------------
# Main RAG function
# -------------------------
# -------------------------
# Main RAG function (updated for consistent PII redaction)
# -------------------------
def query_rag(question: str) -> dict:
    stopped_by = None
    decision = "ALLOW"
    reason = ""
    score = 0.0

    # 1) Query-level prompt-injection detection
    inj_flag, inj_score = firewall.detect_injection(question)
    if inj_flag and inj_score >= firewall.INJECTION_THRESHOLD:
        stopped_by = "Query Firewall"
        decision = "BLOCK"
        reason = "prompt_injection"
        score = inj_score
        write_csv_log({"query": question, "score": score, "decision": decision, "reason": reason, "stopped_by": stopped_by})
        print("\n⚠️ Blocked by Query Firewall\n")
        return {"query": question, "score": score, "decision": decision, "reason": reason, "stopped_by": stopped_by}

    # 2) Retrieve documents
    try:
        docs = retriever.get_relevant_documents(question)
    except AttributeError:
        docs = retriever._get_relevant_documents(question, run_manager=None)
    except Exception as e:
        print(f"[rag] Document retrieval failed: {e}")
        docs = []

    # 3) Build safe context (documents inspected & redacted)
    context, redaction_info = build_safe_context(docs)

    # 4) Build prompt for LLM and check injection
    prompt = f"{SYSTEM_INSTRUCTION}\n\n{context}\n\nUser: {question}\nAssistant:"
    p_inj_flag, p_inj_score = firewall.detect_injection(prompt)
    if p_inj_flag and p_inj_score >= firewall.INJECTION_THRESHOLD:
        stopped_by = "Prompt Firewall"
        decision = "BLOCK"
        reason = "prompt_injection_in_prompt"
        score = p_inj_score
        write_csv_log({"query": question, "score": score, "decision": decision, "reason": reason, "stopped_by": stopped_by})
        print("\n⚠️ Blocked by Prompt Firewall\n")
        return {"query": question, "score": score, "decision": decision, "reason": reason, "stopped_by": stopped_by}

    # 5) Generate LLM response
    response = ollama.generate(model=LLM_MODEL, prompt=prompt)
    llm_text = getattr(response, "response", getattr(response, "text", getattr(response, "content", str(response)))).strip()
    llm_answer = clean_rag_output(llm_text)

    # 6) Inspect LLM output for injection
    out_inj_flag, out_inj_score = firewall.detect_injection(llm_answer)
    if out_inj_flag and out_inj_score >= firewall.INJECTION_THRESHOLD:
        stopped_by = "Output Firewall"
        decision = "BLOCK"
        reason = "prompt_injection_in_output"
        score = out_inj_score
        write_csv_log({"query": question, "score": score, "decision": decision, "reason": reason, "stopped_by": stopped_by})
        print("\n⚠️ Blocked by Output Firewall\n")
        return {"query": question, "score": score, "decision": decision, "reason": reason, "stopped_by": stopped_by}

    # 7) Post-process: ensure consistent PII redaction for requested entities
    requested_entities = extract_entities_from_question(question)
    subject = extract_subject_name(question)

    final_lines = []

    if requested_entities:
        # Always redact requested entities, regardless of document content
        for ent in requested_entities:
            placeholder = f"<REDACTED:{'email' if 'email' in ent else ('phone' if 'phone' in ent else 'pii')}>"
            if subject:
                final_lines.append(f"{subject}'s {ent} is {placeholder}")
            else:
                final_lines.append(f"The {ent} is {placeholder}")
        explanation = (
            "I apologize, but I cannot provide the real value because it is sensitive personal information. "
            "It has been redacted to protect privacy."
        )
        final_answer = "\n".join(final_lines) + "\n\n" + explanation
    else:
        # No requested entity: sanitize any PII in LLM answer
        final_answer = firewall.sanitize_text(llm_answer)

    # 8) Print and log
    print("\n🧠 LLM Answer:\n" + final_answer + "\n")

    result = {"query": question, "score": score, "decision": decision, "reason": reason, "stopped_by": stopped_by}
    write_csv_log(result)
    return result

# -------------------------
# CLI
# -------------------------
def run_cli():
    print("\nRAG CLI — Type 'exit' to quit.\n")
    while True:
        try:
            q = input("Your question> ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nExiting CLI.")
            break
        if not q or q.lower() in ("exit", "quit"):
            break
        query_rag(q)

if __name__ == "__main__":
    run_cli()
