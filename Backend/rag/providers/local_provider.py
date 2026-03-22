import ollama
from langchain_core.documents import Document

from backend.rag.providers.base import BaseRAGProvider, RetrievalResult, GenerationResult
from backend.rag.retriever import retrieve_with_scores, _ensure_vectorstore


class LocalRAGProvider(BaseRAGProvider):
    """
    Local RAG provider using Ollama (llama2) + Chroma (in-memory).
    Wraps the existing retriever.py and ollama calls with zero behavioral change.
    Requires Ollama running locally with llama2 and nomic-embed-text models pulled.
    """

    LLM_MODEL = "llama2"
    LLM_OPTIONS = {
        "temperature": 0.3,
        "top_p": 0.9,
        "top_k": 40,
        "num_predict": 256,
        "repeat_penalty": 1.15,
    }

    def retrieve(self, query: str) -> list[RetrievalResult]:
        raw = retrieve_with_scores(query)
        return [RetrievalResult(document=doc, similarity_score=score) for doc, score in raw]

    def generate(self, prompt: str) -> GenerationResult:
        response = ollama.generate(
            model=self.LLM_MODEL,
            prompt=prompt,
            options=self.LLM_OPTIONS
        )
        return GenerationResult(raw_text=response.get("response", ""), provider="local")

    def ingest_documents(self, documents: list[Document]) -> None:
        _ensure_vectorstore(force_reload=True)

    def delete_documents(self, filenames: list[str]) -> None:
        # Chroma is rebuilt from disk; file deletion happens at the API layer
        # before this is called, so a force reload picks up the change.
        _ensure_vectorstore(force_reload=True)

    def health_check(self) -> dict:
        try:
            ollama.list()
            return {
                "provider": "local",
                "llm": self.LLM_MODEL,
                "vector_db": "chroma_in_memory",
                "status": "ok"
            }
        except Exception as e:
            return {"provider": "local", "status": "error", "error": str(e)}
