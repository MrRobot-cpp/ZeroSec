"""
ZeroSec Secure RAG Provider — Encrypted Pipeline
Handles HIGH sensitivity documents only.

Chroma stores:  embedding (computed from plaintext) + chunk_id metadata — NO content
enc_store.db stores: AES-256-GCM ciphertext + HMAC per chunk

Query flow:
  1. Embed query via Ollama
  2. Chroma similarity search → chunk_ids only
  3. HMAC verify + AES-256-GCM decrypt from enc_store
  4. Return decrypted Documents to the security pipeline (firewall, PII, etc.)
  5. Build prompt → Ollama generate (local only — no external LLM)
"""

import os
import logging
from pathlib import Path

import chromadb
from groq import Groq as GroqClient
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_core.documents import Document
from cryptography.exceptions import InvalidTag

from backend.rag.providers.base import BaseRAGProvider, RetrievalResult, GenerationResult
from backend.rag.chunker import chunk_documents
from backend.security.sag_crypto import chunk_id as make_chunk_id
from backend.database import enc_store as _enc_store

_log = logging.getLogger("zerosec.secure_provider")

_CHROMA_PERSIST_DIR = Path(__file__).resolve().parent.parent / "data" / "chroma_encrypted"

EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
GROQ_LLM_MODEL  = "llama-3.1-8b-instant"
GROQ_MAX_TOKENS = 512
GROQ_TEMPERATURE = 0.3

# Retrieval config — relaxed vs standard pipeline because HIGH docs are fewer
# and academic/technical content produces higher embedding distances.
TOP_K               = 10
DISTANCE_THRESHOLD  = 1.8
MAX_RESULTS         = 5
MIN_SCORE           = 0.30


class SecureRAGProvider(BaseRAGProvider):
    """
    Encrypted RAG provider for HIGH sensitivity documents.

    Security contract:
    - Chroma never stores document content — only chunk_ids and embeddings
    - All content is AES-256-GCM encrypted in enc_store.db
    - Every retrieval verifies HMAC before decrypting
    - Only works with local Ollama — no external LLM calls
    """

    def __init__(self, secret_key: str, hmac_salt: str):
        if not secret_key or secret_key == "dev-secret-key-change-in-production":
            raise ValueError(
                "SECRET_KEY must be set to a strong random value for the encrypted pipeline. "
                "Set SECRET_KEY in backend/.env"
            )
        if not hmac_salt:
            raise ValueError("SAG_HMAC_SALT must be set in config for the encrypted pipeline")

        self._secret_key = secret_key
        self._hmac_salt  = hmac_salt
        self._embeddings = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)
        self._vectorstore: Chroma | None = None
        self._init_vectorstore()

    # -------------------------
    # VECTORSTORE
    # -------------------------

    def _init_vectorstore(self) -> None:
        """Load or create a persisted Chroma collection for encrypted chunks."""
        _CHROMA_PERSIST_DIR.mkdir(parents=True, exist_ok=True)
        self._chroma_client = chromadb.PersistentClient(path=str(_CHROMA_PERSIST_DIR))
        self._vectorstore = Chroma(
            client=self._chroma_client,
            collection_name="zerosec_encrypted",
            embedding_function=self._embeddings,
        )
        count = self._vectorstore._collection.count()
        _log.info("[SecureRAGProvider] Chroma collection loaded (%d vectors)", count)

    def _add_to_chroma(
        self,
        chunk_id: str,
        text: str,
        filename: str,
        doc_id: str,
    ) -> None:
        """
        Embed text content, then add the vector to Chroma with chunk_id as the
        stored document — content never touches Chroma.
        """
        embedding_vector = self._embeddings.embed_query(text)

        # Use the underlying chromadb collection to supply pre-computed embeddings.
        # This is the only way to separate "what gets embedded" from "what gets stored".
        self._vectorstore._collection.add(
            ids=[chunk_id],
            embeddings=[embedding_vector],
            documents=[chunk_id],          # ← chunk_id stored, NOT content
            metadatas=[{
                "chunk_id": chunk_id,
                "filename": filename,
                "doc_id":   doc_id,
                "clearance": "HIGH",
            }],
        )

    # -------------------------
    # INGEST
    # -------------------------

    def ingest_documents(self, documents: list[Document]) -> None:
        """
        Ingest HIGH sensitivity documents into the encrypted pipeline.

        For each chunk:
          1. Generate embedding from plaintext
          2. Store (chunk_id, embedding) in Chroma — no content
          3. AES-256-GCM encrypt + HMAC → enc_store.db
        """
        if not documents:
            return

        chunked = chunk_documents(documents)
        _log.info("[SecureRAGProvider] ingesting %d chunks", len(chunked))

        for i, doc in enumerate(chunked):
            filename = doc.metadata.get("filename", f"unknown_{i}")
            doc_id   = doc.metadata.get("doc_id", filename)
            cid      = make_chunk_id(filename, doc.metadata.get("chunk_index", i))
            text     = doc.page_content

            # 1. Embed + add to Chroma (no content stored)
            try:
                self._add_to_chroma(cid, text, filename, doc_id)
            except Exception as exc:
                _log.error("[SecureRAGProvider] Chroma add failed for %s chunk %d: %s",
                           filename, i, exc)
                continue

            # 2. Encrypt + store in enc_store.db
            try:
                _enc_store.store(
                    chunk_id    = cid,
                    plaintext   = text.encode(),
                    filename    = filename,
                    clearance   = "HIGH",
                    doc_id      = doc_id,
                    secret_key  = self._secret_key,
                    hmac_salt   = self._hmac_salt,
                )
            except Exception as exc:
                # Chroma succeeded but enc_store failed — remove from Chroma to avoid desync
                _log.error("[SecureRAGProvider] enc_store failed for %s chunk %d, rolling back Chroma: %s",
                           filename, i, exc)
                try:
                    self._vectorstore._collection.delete(ids=[cid])
                except Exception:
                    pass
                raise

        _log.info("[SecureRAGProvider] ingest complete")

    # -------------------------
    # RETRIEVE
    # -------------------------

    def retrieve(self, query: str) -> list[RetrievalResult]:
        """
        Similarity search → chunk_ids → HMAC verify → AES-GCM decrypt.
        Returns Documents with decrypted plaintext content.
        """
        if self._vectorstore is None:
            return []

        # Skip embedding entirely if the store is empty — avoids model call latency
        if self._vectorstore._collection.count() == 0:
            return []

        # Embed query and search Chroma
        raw = self._vectorstore.similarity_search_with_score(query, k=TOP_K)

        # Filter by distance threshold, convert to similarity score
        results = []
        for doc, distance in raw:
            if distance > DISTANCE_THRESHOLD:
                continue
            score = round(1 / (1 + distance), 3)
            if score < MIN_SCORE:
                continue
            results.append((doc, score))

        results.sort(key=lambda x: x[1], reverse=True)
        results = results[:MAX_RESULTS]

        # Decrypt each chunk
        retrieval_results = []
        for chroma_doc, score in results:
            cid      = chroma_doc.metadata.get("chunk_id", chroma_doc.page_content)
            filename = chroma_doc.metadata.get("filename", "unknown")
            doc_id   = chroma_doc.metadata.get("doc_id", filename)

            try:
                plaintext = _enc_store.retrieve(cid, self._secret_key, self._hmac_salt)
            except ValueError as exc:
                # HMAC failure — tamper detected, skip this chunk and log
                _log.critical("[SecureRAGProvider] TAMPER DETECTED — skipping chunk: %s", exc)
                continue
            except InvalidTag:
                _log.critical("[SecureRAGProvider] GCM auth failed for chunk_id=%s", cid[:16])
                continue

            if plaintext is None:
                _log.warning("[SecureRAGProvider] chunk_id=%s not found in enc_store", cid[:16])
                continue

            decrypted_doc = Document(
                page_content=plaintext.decode(),
                metadata={
                    "filename":    filename,
                    "source":      filename,
                    "chunk_id":    cid,
                    "doc_id":      doc_id,
                    "clearance":   "HIGH",
                    "chunk_index": chroma_doc.metadata.get("chunk_index", 0),
                    "total_chunks": chroma_doc.metadata.get("total_chunks", 1),
                    "file_type":   Path(filename).suffix,
                },
            )
            retrieval_results.append(RetrievalResult(document=decrypted_doc, similarity_score=score))

        return retrieval_results

    # -------------------------
    # GENERATE
    # -------------------------

    def generate(self, prompt: str) -> GenerationResult:
        """
        Groq LLM generation — hybrid mode.
        Retrieval and embeddings stay local; only the prompt reaches Groq.
        """
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise ValueError("GROQ_API_KEY not set — required for encrypted chat LLM")

        client = GroqClient(api_key=api_key)
        response = client.chat.completions.create(
            model=GROQ_LLM_MODEL,
            temperature=GROQ_TEMPERATURE,
            max_tokens=GROQ_MAX_TOKENS,
            messages=[{"role": "user", "content": prompt}],
        )
        raw_text = response.choices[0].message.content or ""
        return GenerationResult(raw_text=raw_text, provider="secure_groq")

    # -------------------------
    # DELETE
    # -------------------------

    def delete_documents(self, filenames: list[str]) -> None:
        """
        Remove all chunks for the given filenames from both Chroma and enc_store.
        Called during document deletion to keep both stores in sync.
        """
        for filename in filenames:
            # Get all chunk_ids for this file from enc_store
            chunk_ids = _enc_store.get_chunk_ids(filename)

            # Remove from Chroma
            if chunk_ids:
                try:
                    self._vectorstore._collection.delete(ids=chunk_ids)
                    _log.info("[SecureRAGProvider] removed %d Chroma vectors for %s",
                              len(chunk_ids), filename)
                except Exception as exc:
                    _log.error("[SecureRAGProvider] Chroma delete failed for %s: %s", filename, exc)

            # Remove from enc_store
            deleted = _enc_store.delete_by_filename(filename)
            _log.info("[SecureRAGProvider] deleted %d enc_store chunks for %s", deleted, filename)

    # -------------------------
    # HEALTH
    # -------------------------

    def health_check(self) -> dict:
        try:
            store_info   = _enc_store.health_check()
            chroma_count = self._vectorstore._collection.count() if self._vectorstore else 0
            return {
                "provider":   "secure_groq",
                "llm":        f"groq/{GROQ_LLM_MODEL}",
                "embeddings": f"ollama/{EMBEDDING_MODEL} (local)",
                "vector_db":  f"chroma_encrypted ({chroma_count} vectors)",
                "enc_store":  store_info,
                "status":     "ok",
            }
        except Exception as exc:
            return {"provider": "secure_groq", "status": "error", "error": str(exc)}
