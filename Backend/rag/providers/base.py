from abc import ABC, abstractmethod
from dataclasses import dataclass
from langchain_core.documents import Document


@dataclass
class RetrievalResult:
    document: Document
    similarity_score: float     # 0-1, higher = more relevant


@dataclass
class GenerationResult:
    raw_text: str
    provider: str               # "local" or "external"


class BaseRAGProvider(ABC):
    """
    Abstract base for all RAG backend providers.

    Security contract: providers are pure infrastructure adapters.
    All security checks (injection detection, PII redaction, canary tokens)
    are applied by rag_service.py BEFORE and AFTER calling these methods.
    Providers must NOT modify prompts or apply security logic internally.
    """

    @abstractmethod
    def retrieve(self, query: str) -> list[RetrievalResult]:
        """
        Retrieve semantically relevant document chunks for a query.
        The query has already been security-checked by the service layer.
        Returns results filtered by the provider's relevance threshold,
        capped at MAX_RESULTS, ordered by descending similarity score.
        """
        ...

    @abstractmethod
    def generate(self, prompt: str) -> GenerationResult:
        """
        Generate a response from the prompt.
        The prompt has already been security-verified by the service layer.
        Implementations MUST NOT modify this prompt.
        """
        ...

    @abstractmethod
    def ingest_documents(self, documents: list[Document]) -> None:
        """
        Ingest documents into the vector store.
        Chunking is performed by this method using the shared chunker.
        Implementations must handle idempotency (re-ingesting same file
        should not create duplicate vectors).
        """
        ...

    @abstractmethod
    def delete_documents(self, filenames: list[str]) -> None:
        """Remove documents from the vector store by filename."""
        ...

    @abstractmethod
    def health_check(self) -> dict:
        """
        Return provider health/status information.
        Returns dict with keys: provider (str), llm (str),
        vector_db (str), status ("ok" | "error"), optional error (str).
        """
        ...
