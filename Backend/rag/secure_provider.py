"""
ZeroSec Secure RAG Provider — Encrypted Pipeline (Phase 3: Ephemeral Index)

Handles HIGH sensitivity documents only.

Security contract:
- Chroma is IN-MEMORY ONLY — embeddings NEVER written to disk
- All content is AES-256-GCM encrypted in enc_store.db
- Every retrieval verifies HMAC before decrypting
- On startup, index is rebuilt from enc_store (decrypt → embed → in-memory Chroma)
- On shutdown, all embeddings vanish — nothing to steal from disk

Query flow:
  1. Embed query via HuggingFace (local)
  2. Chroma similarity search → chunk_ids only
  3. HMAC verify + AES-256-GCM decrypt from enc_store
  4. Return decrypted Documents to the security pipeline
  5. Build prompt → Groq generate
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

# Legacy persist dir — will be cleaned up if found
_CHROMA_PERSIST_DIR = Path(__file__).resolve().parent.parent / "data" / "chroma_encrypted"

EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
GROQ_LLM_MODEL  = "llama-3.1-8b-instant"
GROQ_MAX_TOKENS = 512
GROQ_TEMPERATURE = 0.3

# Retrieval config
TOP_K               = 10
DISTANCE_THRESHOLD  = 1.8
MAX_RESULTS         = 5
MIN_SCORE           = 0.30


class SecureRAGProvider(BaseRAGProvider):
    """
    Encrypted RAG provider for HIGH sensitivity documents.

    Phase 3 security:
    - Chroma runs in-memory ONLY — no PersistentClient, no disk writes
    - Embeddings are rebuilt from enc_store.db on every startup
    - Disk attacker gets ZERO embedding data
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

        # Reusable Groq client — avoid TCP reconnect on every generate() call
        api_key = os.getenv("GROQ_API_KEY")
        self._groq_client = GroqClient(api_key=api_key) if api_key else None

        self._cleanup_legacy_persist_dir()
        self._init_vectorstore()
        try:
            self._rebuild_from_enc_store()
        except Exception as exc:
            _log.error(
                "[SecureRAGProvider] enc_store rebuild failed (non-fatal, "
                "index will be empty until next ingest): %s", exc
            )

    # -------------------------
    # VECTORSTORE (EPHEMERAL)
    # -------------------------

    def _cleanup_legacy_persist_dir(self) -> None:
        """
        Phase 3 migration: delete legacy chroma_encrypted/ directory.
        These files contained PLAINTEXT embeddings on disk — the vulnerability
        that Phase 3 eliminates by switching to ephemeral in-memory Chroma.
        """
        if _CHROMA_PERSIST_DIR.exists():
            import shutil
            try:
                shutil.rmtree(str(_CHROMA_PERSIST_DIR))
                _log.warning(
                    "[SecureRAGProvider] DELETED legacy chroma_encrypted/ — "
                    "plaintext embeddings removed from disk (Phase 3 migration)"
                )
            except Exception as exc:
                _log.error(
                    "[SecureRAGProvider] Failed to delete legacy chroma_encrypted/: %s", exc
                )

    def _init_vectorstore(self) -> None:
        """Create an in-memory Chroma collection. Nothing touches disk."""
        # Use EphemeralClient explicitly — guarantees no disk I/O.
        # chromadb.Client() is ambiguous across versions and may pick up
        # stale chroma.sqlite3 files on disk, causing 'no such table' errors.
        self._chroma_client = chromadb.EphemeralClient()
        self._vectorstore = Chroma(
            client=self._chroma_client,
            collection_name="zerosec_encrypted",
            embedding_function=self._embeddings,
        )
        _log.info("[SecureRAGProvider] Ephemeral in-memory Chroma initialised (Phase 3)")

    def _rebuild_from_enc_store(self) -> None:
        """
        Rebuild the in-memory Chroma index from enc_store.db on startup.

        For each stored row:
          1. Verify HMAC integrity
          2. Decrypt chunk content
          3. Embed plaintext → add vector to in-memory Chroma (no content stored)

        Plaintext only exists in RAM during this process — never touches disk.
        """
        rows = _enc_store.get_all_rows()
        if not rows:
            _log.info("[SecureRAGProvider] enc_store empty — nothing to rebuild")
            return

        _log.info("[SecureRAGProvider] Rebuilding ephemeral index from %d encrypted chunks...", len(rows))
        rebuilt = 0
        skipped = 0

        for row in rows:
            cid      = row["chunk_id"]
            filename = row["filename"]
            doc_id   = row["doc_id"]

            try:
                plaintext = _enc_store.retrieve(cid, self._secret_key, self._hmac_salt)
            except (ValueError, InvalidTag) as exc:
                _log.critical("[SecureRAGProvider] SKIP corrupt chunk %s: %s", cid[:16], exc)
                skipped += 1
                continue

            if plaintext is None:
                skipped += 1
                continue

            text = plaintext.decode("utf-8", errors="ignore")

            try:
                self._add_to_chroma(cid, text, filename, doc_id)
                rebuilt += 1
            except Exception as exc:
                _log.error("[SecureRAGProvider] Failed to embed chunk %s: %s", cid[:16], exc)
                skipped += 1

        _log.info(
            "[SecureRAGProvider] Ephemeral index ready — %d vectors rebuilt, %d skipped",
            rebuilt, skipped
        )

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

        self._vectorstore._collection.add(
            ids=[chunk_id],
            embeddings=[embedding_vector],
            documents=[chunk_id],          # chunk_id stored, NOT content
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

            # 1. Embed + add to in-memory Chroma (no content stored)
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

        if self._vectorstore._collection.count() == 0:
            return []

        raw = self._vectorstore.similarity_search_with_score(query, k=TOP_K)

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

        retrieval_results = []
        for chroma_doc, score in results:
            cid      = chroma_doc.metadata.get("chunk_id", chroma_doc.page_content)
            filename = chroma_doc.metadata.get("filename", "unknown")
            doc_id   = chroma_doc.metadata.get("doc_id", filename)

            try:
                plaintext = _enc_store.retrieve(cid, self._secret_key, self._hmac_salt)
            except ValueError as exc:
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
        if not self._groq_client:
            raise ValueError("GROQ_API_KEY not set — required for encrypted chat LLM")

        response = self._groq_client.chat.completions.create(
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
        """
        for filename in filenames:
            chunk_ids = _enc_store.get_chunk_ids(filename)

            if chunk_ids:
                try:
                    self._vectorstore._collection.delete(ids=chunk_ids)
                    _log.info("[SecureRAGProvider] removed %d in-memory vectors for %s",
                              len(chunk_ids), filename)
                except Exception as exc:
                    _log.error("[SecureRAGProvider] Chroma delete failed for %s: %s", filename, exc)

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
                "provider":     "secure_groq",
                "llm":          f"groq/{GROQ_LLM_MODEL}",
                "embeddings":   f"local/{EMBEDDING_MODEL}",
                "vector_db":    f"chroma_ephemeral ({chroma_count} vectors, in-memory only)",
                "enc_store":    store_info,
                "phase":        "Phase 3 — ephemeral index",
                "disk_vectors": False,
                "status":       "ok",
            }
        except Exception as exc:
            return {"provider": "secure_groq", "status": "error", "error": str(exc)}
