"""
Hybrid RAG Provider: Groq API (LLM) + Local Chroma (Vector Storage)

Perfect for users who want:
- Fast, high-quality LLM responses from Groq API
- Local vector storage without cloud dependencies
- Reuse existing documents from local provider

Requirements: GROQ_API_KEY + Ollama running locally
Vector DB: Uses same in-memory Chroma as LocalRAGProvider (backend/data/docs/)
"""

import os

from langchain_core.documents import Document

from backend.rag.providers.base import BaseRAGProvider, RetrievalResult, GenerationResult
from backend.rag.retriever import retrieve_with_scores, _ensure_vectorstore


class HybridRAGProvider(BaseRAGProvider):
    """
    Hybrid RAG provider using:
    - Groq API (Llama 3.1 8B) for LLM generation — free tier, 14,400 req/day
    - Same retrieval as LocalRAGProvider (Ollama embeddings + in-memory Chroma)

    Security contract: this provider is a pure infrastructure adapter.
    All injection detection, PII redaction, and canary token checks are
    applied by rag_service.py BEFORE and AFTER calling retrieve/generate.

    Required: GROQ_API_KEY + Ollama running locally
    """

    DEFAULT_LLM_MODEL = "llama-3.1-8b-instant"

    def __init__(self, config: dict = None):
        from groq import Groq

        cfg = config or {}

        # LLM configuration (Groq)
        self._llm_model = cfg.get("groq_llm_model") or os.getenv("GROQ_LLM_MODEL", self.DEFAULT_LLM_MODEL)
        self._temperature = float(cfg.get("groq_temperature") or os.getenv("GROQ_TEMPERATURE", "0.3"))
        self._max_tokens = int(cfg.get("groq_max_tokens") or os.getenv("GROQ_MAX_TOKENS", "1024"))

        groq_api_key = cfg.get("groq_api_key") or os.getenv("GROQ_API_KEY")
        if not groq_api_key:
            raise ValueError("GROQ_API_KEY is required for hybrid provider")
        self._groq = Groq(api_key=groq_api_key)

        print(f"[HybridRAGProvider] Ready — LLM: groq/{self._llm_model}, VectorDB: chroma (same as local)")

    def retrieve(self, query: str) -> list[RetrievalResult]:
        """
        Use exact same retrieval as LocalRAGProvider.
        Wraps retrieve_with_scores() from retriever.py.
        """
        raw = retrieve_with_scores(query)
        return [RetrievalResult(document=doc, similarity_score=score) for doc, score in raw]

    def generate(self, prompt: str) -> GenerationResult:
        """
        Send the complete RAG prompt to Groq.
        Passes the full prompt as a single user message - same behavior as Ollama.
        """
        print(f"[HybridRAG] Sending prompt ({len(prompt)} chars) to Groq...")

        response = self._groq.chat.completions.create(
            model=self._llm_model,
            temperature=self._temperature,
            max_tokens=self._max_tokens,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        raw_text = response.choices[0].message.content or ""
        print(f"[HybridRAG] Response: {raw_text[:200]}...")
        return GenerationResult(raw_text=raw_text, provider="hybrid")

    def ingest_documents(self, documents: list[Document]) -> None:
        """
        Same as LocalRAGProvider: force reload vectorstore from docs directory.
        """
        _ensure_vectorstore(force_reload=True)

    def delete_documents(self, filenames: list[str]) -> None:
        """
        Same as LocalRAGProvider: force reload vectorstore after deletion.
        """
        _ensure_vectorstore(force_reload=True)

    def health_check(self) -> dict:
        """Check Groq API connectivity and Ollama status."""
        try:
            # Test Groq API with minimal request
            test_response = self._groq.chat.completions.create(
                model=self._llm_model,
                max_tokens=5,
                messages=[{"role": "user", "content": "test"}]
            )
            groq_ok = test_response is not None

            # Test Ollama (required for embeddings)
            import ollama
            ollama.list()

            return {
                "provider": "hybrid",
                "llm": f"groq/{self._llm_model}",
                "vector_db": "chroma_in_memory (same as local)",
                "embeddings": "nomic-embed-text (ollama)",
                "status": "ok" if groq_ok else "error"
            }
        except Exception as e:
            return {"provider": "hybrid", "status": "error", "error": str(e)}
