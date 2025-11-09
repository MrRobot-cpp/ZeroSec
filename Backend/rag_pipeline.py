"""
RAG pipeline (Ollama) + ZeroSec firewall.
Writes results automatically to CSV log.
Provides query_rag(question) -> dict with:
{
    "query": str,
    "score": float,
    "decision": "ALLOW"|"BLOCK"|"QUARANTINE",
    "reason": str,
    "stopped_by": str or None
}
"""

import re
from pathlib import Path
import csv
import datetime
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

SAFE_REASON_MAP = {
    "injection": "high-risk content",
    "exfil_multiple": "high-risk content",
    "exfil_single": "partially redacted",
    "clean": "clean"
}

def safe_reason_label(reason: str) -> str:
    return SAFE_REASON_MAP.get(reason, "high-risk content")


# -------------------------
# Initialize CSV log
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
        "decision": result.get("decision", "ALLOW").upper(),
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
# Clean LLM output
# -------------------------
def clean_rag_output(text: str) -> str:
    if not text:
        return ""
    t = re.sub(r"(?mi)^\s*(Your\s+question|Question|Answer|User|Assistant)[:>\-]?\s*", "", text)
    t = t.strip()
    t = re.sub(r"(?:\r?\n){3,}", "\n\n", t)
    return "\n".join(line.lstrip() for line in t.splitlines())


# -------------------------
# Build safe context
# -------------------------
def build_safe_context(docs, max_docs=MAX_DOCS, max_chars_per_doc=MAX_CHARS_PER_DOC):
    parts = []
    removed = []

    for i, doc in enumerate(docs[:max_docs]):
        name = getattr(doc, "metadata", {}).get("source", f"doc_{i}")
        text = getattr(doc, "page_content", str(doc))
        info = firewall.inspect_document_text(text)

        if not info.get("include", False):
            removed.append((name, safe_reason_label(info.get("reason", "high-risk"))))
            continue

        snippet = (info.get("safe_text") or "")[:max_chars_per_doc]
        parts.append(f"--- Document: {name} ---\n{snippet}\n")

    header = ""
    if removed:
        parts_list = [f"{n} ({r})" for (n, r) in removed]
        joined = ", ".join(parts_list)
        header = (
            f"[NOTICE] Some retrieved documents were removed for safety: {joined}.\n"
            "Use only the documents shown below. Do not guess or infer removed content.\n\n"
        )

    return header + "\n".join(parts)


# -------------------------
# Main RAG query function
# -------------------------
def query_rag(question: str) -> dict:
    stopped_by = None
    decision = "ALLOW"
    reason = ""
    score = 0.0
    llm_answer = ""

    # Retrieve documents
    try:
        docs = retriever.get_relevant_documents(question)
    except Exception:
        docs = retriever._get_relevant_documents(question, run_manager=None)

    context = build_safe_context(docs) if docs else ""

    # Firewall on query
    q_info = firewall.inspect_text(question)
    if q_info["decision"].upper() == "BLOCK":
        stopped_by = "Query Firewall"
        decision = "BLOCK"
        reason = q_info.get("reason", "high-risk content")
        score = 1.0
    elif q_info["decision"].upper() == "QUARANTINE":
        question = q_info.get("sanitized", question)
        stopped_by = "Query Firewall"
        decision = "QUARANTINE"
        reason = q_info.get("reason", "")
        score = 1.0

    # Build prompt + firewall check
    prompt = f"{SYSTEM_INSTRUCTION}\n\n{context}\n\nUser: {question}\nAssistant:"
    p_info = firewall.inspect_text(prompt)
    if p_info["decision"].upper() != "ALLOW":
        stopped_by = "Prompt Firewall"
        decision = p_info["decision"].upper()
        reason = p_info.get("reason", "")
        score = 1.0

    # Generate LLM response if allowed
    if decision in ["ALLOW", "QUARANTINE"]:
        response = ollama.generate(model=LLM_MODEL, prompt=prompt)
        llm_text = getattr(response, "response", getattr(response, "text", getattr(response, "content", str(response)))).strip()
        llm_answer = clean_rag_output(llm_text)

        o_info = firewall.inspect_text(llm_answer)
        if o_info["decision"].upper() != "ALLOW":
            stopped_by = "Output Firewall"
            decision = o_info["decision"].upper()
            reason = o_info.get("reason", "")
            score = 1.0

        # Print answer to terminal
        print("\n🧠 LLM Answer:\n" + llm_answer + "\n")

    else:
        print("\n⚠️  Blocked by Firewall:", stopped_by or decision, "\n")

    result = {
        "query": question,
        "score": score,
        "decision": decision,
        "reason": reason,
        "stopped_by": stopped_by
    }

    # Write to CSV
    write_csv_log(result)
    return result


# -------------------------
# CLI for testing
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
        ans = query_rag(q)
        print("Firewall Log:", ans, "\n")


if __name__ == "__main__":
    run_cli()
