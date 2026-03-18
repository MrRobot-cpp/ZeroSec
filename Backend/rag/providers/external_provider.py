import os
from langchain_core.documents import Document

from backend.rag.providers.base import BaseRAGProvider, RetrievalResult, GenerationResult
from backend.rag.chunker import chunk_documents


class ExternalRAGProvider(BaseRAGProvider):
    """
    External RAG provider using:
    - Groq API (Llama 3.1 8B) for LLM generation — free tier, 14,400 req/day
    - sentence-transformers/all-MiniLM-L6-v2 for embeddings — local, no API key
    - Qdrant Cloud for vector storage — free tier, 1GB

    Security contract: this provider is a pure infrastructure adapter.
    All injection detection, PII redaction, and canary token checks are
    applied by rag_service.py BEFORE and AFTER calling retrieve/generate.
    This provider must NOT modify prompts or apply security logic internally.

    Required env vars: GROQ_API_KEY, QDRANT_URL, QDRANT_API_KEY
    """

    EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
    VECTOR_SIZE = 384           # all-MiniLM-L6-v2 output dimension
    DEFAULT_LLM_MODEL = "llama-3.1-8b-instant"

    def __init__(self, config: dict = None):
        from groq import Groq
        from langchain_huggingface import HuggingFaceEmbeddings
        from langchain_qdrant import QdrantVectorStore
        from qdrant_client import QdrantClient
        from qdrant_client.models import Distance, VectorParams

        cfg = config or {}

        self._collection = cfg.get("qdrant_collection") or os.getenv("QDRANT_COLLECTION", "zerosec_docs")
        self._top_k = int(cfg.get("rag_top_k") or os.getenv("RAG_TOP_K", "8"))
        self._max_results = int(cfg.get("rag_max_results") or os.getenv("RAG_MAX_RESULTS", "4"))
        self._similarity_threshold = float(cfg.get("qdrant_similarity_threshold") or os.getenv("QDRANT_SIMILARITY_THRESHOLD", "0.30"))
        self._llm_model = cfg.get("groq_llm_model") or os.getenv("GROQ_LLM_MODEL", self.DEFAULT_LLM_MODEL)
        self._temperature = float(cfg.get("groq_temperature") or os.getenv("GROQ_TEMPERATURE", "0.3"))
        self._max_tokens = int(cfg.get("groq_max_tokens") or os.getenv("GROQ_MAX_TOKENS", "512"))

        groq_api_key = cfg.get("groq_api_key") or os.getenv("GROQ_API_KEY")
        self._groq = Groq(api_key=groq_api_key)

        # Embeddings run locally via sentence-transformers (no API key needed)
        print("[ExternalRAGProvider] Loading sentence-transformers embeddings model...")
        self._embeddings = HuggingFaceEmbeddings(model_name=self.EMBEDDING_MODEL)

        qdrant_url = cfg.get("qdrant_url") or os.getenv("QDRANT_URL")
        qdrant_api_key = cfg.get("qdrant_api_key") or os.getenv("QDRANT_API_KEY")
        self._qdrant_client = QdrantClient(
            url=qdrant_url,
            api_key=qdrant_api_key
        )
        self._ensure_collection(Distance, VectorParams)

        self._vectorstore = QdrantVectorStore(
            client=self._qdrant_client,
            collection_name=self._collection,
            embedding=self._embeddings
        )

        print(f"[ExternalRAGProvider] Ready — LLM: {self._llm_model}, VectorDB: {self._collection}")

    def _ensure_collection(self, Distance, VectorParams) -> None:
        """Create the Qdrant collection if it doesn't exist yet."""
        existing = [c.name for c in self._qdrant_client.get_collections().collections]
        if self._collection not in existing:
            from qdrant_client.models import VectorParams, Distance
            self._qdrant_client.create_collection(
                collection_name=self._collection,
                vectors_config=VectorParams(size=self.VECTOR_SIZE, distance=Distance.COSINE)
            )
            print(f"[ExternalRAGProvider] Created Qdrant collection: {self._collection}")

    def retrieve(self, query: str) -> list[RetrievalResult]:
        """
        Embed query via sentence-transformers, search Qdrant, filter by threshold.
        Qdrant via langchain-qdrant returns cosine similarity scores (0-1, higher = more relevant).
        """
        results = self._vectorstore.similarity_search_with_score(query, k=self._top_k)

        filtered = [
            (doc, score) for doc, score in results
            if score >= self._similarity_threshold
        ]
        filtered.sort(key=lambda x: x[1], reverse=True)

        return [
            RetrievalResult(document=doc, similarity_score=round(score, 3))
            for doc, score in filtered[:self._max_results]
        ]

    def generate(self, prompt: str) -> GenerationResult:
        """
        Send the pre-built, security-checked prompt to Groq.
        Splits at '=== DOCUMENTS ===' to form system + user messages.
        """
        if "=== DOCUMENTS ===" in prompt:
            idx = prompt.index("=== DOCUMENTS ===")
            system_msg = prompt[:idx].strip()
            user_msg = prompt[idx:].strip()
        else:
            system_msg = "You are a helpful RAG assistant that answers questions using the provided documents."
            user_msg = prompt

        response = self._groq.chat.completions.create(
            model=self._llm_model,
            temperature=self._temperature,
            max_tokens=self._max_tokens,
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_msg}
            ]
        )
        raw_text = response.choices[0].message.content or ""
        return GenerationResult(raw_text=raw_text, provider="external")

    def ingest_documents(self, documents: list[Document]) -> None:
        """
        Chunk and upsert documents to Qdrant.
        Deletes existing chunks for the same filenames first to prevent duplicates.
        """
        if not documents:
            return
        filenames = [d.metadata.get("filename", "") for d in documents if d.metadata.get("filename")]
        if filenames:
            self.delete_documents(filenames)

        chunked = chunk_documents(documents)
        if chunked:
            self._vectorstore.add_documents(chunked)
            print(f"[ExternalRAGProvider] Ingested {len(chunked)} chunks into Qdrant")

    def delete_documents(self, filenames: list[str]) -> None:
        """Delete all Qdrant points where metadata.filename matches."""
        from qdrant_client.models import Filter, FieldCondition, MatchAny
        for filename in filenames:
            self._qdrant_client.delete(
                collection_name=self._collection,
                points_selector=Filter(
                    must=[FieldCondition(
                        key="metadata.filename",
                        match=MatchAny(any=[filename])
                    )]
                )
            )

    def health_check(self) -> dict:
        try:
            self._qdrant_client.get_collection(self._collection)
            return {
                "provider": "external",
                "llm": self._llm_model,
                "vector_db": f"qdrant:{self._collection}",
                "embeddings": self.EMBEDDING_MODEL,
                "status": "ok"
            }
        except Exception as e:
            return {"provider": "external", "status": "error", "error": str(e)}
