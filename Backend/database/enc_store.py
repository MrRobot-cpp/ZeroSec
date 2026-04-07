"""
ZeroSec Encrypted Chunk Store
SQLite-backed store for AES-256-GCM encrypted document chunks.

Schema lives in a separate enc_store.db — completely isolated from zerosec.db.
All reads verify HMAC before decrypting. All writes compute HMAC after encrypting.

Five public operations:
  store()        — encrypt and persist a chunk
  retrieve()     — HMAC-verify and decrypt a chunk
  get_chunk_ids()— list all chunk_ids for a filename (for deletion)
  delete_by_filename() — remove all chunks for a document
  clear_all()    — wipe entire store (used for resync after desync)
"""

import sqlite3
import logging
from pathlib import Path
from datetime import datetime

from cryptography.exceptions import InvalidTag

from backend.security.sag_crypto import (
    derive_key,
    encrypt,
    decrypt,
    compute_hmac,
    verify_hmac,
)

_log = logging.getLogger("zerosec.enc_store")

# enc_store.db lives next to zerosec.db in the backend/ directory
_DB_PATH = Path(__file__).resolve().parent.parent / "enc_store.db"

_CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS encrypted_chunks (
    chunk_id        TEXT PRIMARY KEY,
    ciphertext      BLOB NOT NULL,
    nonce           BLOB NOT NULL,
    auth_tag        BLOB NOT NULL,
    integrity_hmac  BLOB NOT NULL,
    filename        TEXT NOT NULL,
    clearance       TEXT NOT NULL,
    doc_id          TEXT NOT NULL,
    key_version     INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT NOT NULL
);
"""

# Index for fast filename-based lookups (delete / list)
_CREATE_INDEX = """
CREATE INDEX IF NOT EXISTS idx_enc_chunks_filename
ON encrypted_chunks (filename);
"""


def _get_conn() -> sqlite3.Connection:
    """Open a connection and ensure the schema exists."""
    conn = sqlite3.connect(str(_DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")   # allow concurrent reads
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute(_CREATE_TABLE)
    conn.execute(_CREATE_INDEX)
    conn.commit()
    return conn


# -------------------------
# PUBLIC API
# -------------------------

def store(
    chunk_id: str,
    plaintext: bytes,
    filename: str,
    clearance: str,
    doc_id: str,
    secret_key: str,
    hmac_salt: str,
    key_version: int = 1,
) -> None:
    """
    Encrypt plaintext and persist the chunk.

    Steps:
    1. Derive document-scoped key via HKDF
    2. AES-256-GCM encrypt
    3. Compute HMAC over all row fields
    4. INSERT into enc_store.db
    """
    key = derive_key(secret_key, doc_id, clearance, key_version)
    ciphertext, nonce, auth_tag = encrypt(plaintext, key)
    mac = compute_hmac(
        chunk_id, ciphertext, auth_tag,
        filename, clearance, doc_id, key_version, hmac_salt
    )

    with _get_conn() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO encrypted_chunks
              (chunk_id, ciphertext, nonce, auth_tag, integrity_hmac,
               filename, clearance, doc_id, key_version, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                chunk_id,
                ciphertext,
                nonce,
                auth_tag,
                mac,
                filename,
                clearance,
                doc_id,
                key_version,
                datetime.utcnow().isoformat(),
            ),
        )

    _log.debug("[enc_store] stored chunk_id=%s filename=%s", chunk_id[:16], filename)


def retrieve(
    chunk_id: str,
    secret_key: str,
    hmac_salt: str,
) -> bytes | None:
    """
    Verify HMAC then decrypt a chunk.

    Returns plaintext bytes, or None if the chunk doesn't exist.
    Raises ValueError on HMAC failure (tamper detected).
    Raises cryptography.exceptions.InvalidTag on GCM auth failure.
    """
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM encrypted_chunks WHERE chunk_id = ?", (chunk_id,)
        ).fetchone()

    if row is None:
        _log.warning("[enc_store] chunk_id not found: %s", chunk_id[:16])
        return None

    # Verify row integrity before attempting decryption
    mac_ok = verify_hmac(
        expected    = bytes(row["integrity_hmac"]),
        chunk_id    = row["chunk_id"],
        ciphertext  = bytes(row["ciphertext"]),
        auth_tag    = bytes(row["auth_tag"]),
        filename    = row["filename"],
        clearance   = row["clearance"],
        doc_id      = row["doc_id"],
        key_version = row["key_version"],
        hmac_salt   = hmac_salt,
    )

    if not mac_ok:
        _log.critical(
            "[enc_store] HMAC FAILURE — tamper detected for chunk_id=%s filename=%s",
            chunk_id[:16], row["filename"]
        )
        raise ValueError(f"Integrity check failed for chunk {chunk_id[:16]} — possible tampering")

    key = derive_key(secret_key, row["doc_id"], row["clearance"], row["key_version"])

    try:
        plaintext = decrypt(bytes(row["ciphertext"]), bytes(row["nonce"]), bytes(row["auth_tag"]), key)
    except InvalidTag:
        _log.critical(
            "[enc_store] GCM auth tag invalid for chunk_id=%s — decryption failed",
            chunk_id[:16]
        )
        raise

    _log.debug("[enc_store] retrieved chunk_id=%s", chunk_id[:16])
    return plaintext


def get_chunk_ids(filename: str) -> list[str]:
    """Return all chunk_ids stored for a given filename."""
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT chunk_id FROM encrypted_chunks WHERE filename = ?", (filename,)
        ).fetchall()
    return [row["chunk_id"] for row in rows]


def delete_by_filename(filename: str) -> int:
    """
    Delete all chunks for a document.
    Returns the number of rows deleted.
    Called during document deletion to keep enc_store in sync with Chroma.
    """
    with _get_conn() as conn:
        cursor = conn.execute(
            "DELETE FROM encrypted_chunks WHERE filename = ?", (filename,)
        )
        deleted = cursor.rowcount

    _log.info("[enc_store] deleted %d chunks for filename=%s", deleted, filename)
    return deleted


def get_all_rows() -> list[dict]:
    """
    Return every row as a dict (for ephemeral index rebuild on startup).
    Does NOT decrypt — caller is responsible for HMAC verify + decrypt.
    """
    with _get_conn() as conn:
        rows = conn.execute("SELECT * FROM encrypted_chunks").fetchall()
    return [dict(row) for row in rows]


def clear_all() -> None:
    """
    Wipe the entire encrypted store.
    Used for full resync after enc_store / Chroma desync.
    """
    with _get_conn() as conn:
        conn.execute("DELETE FROM encrypted_chunks")
    _log.warning("[enc_store] store cleared — full re-ingest required")


def health_check() -> dict:
    """Return basic store stats for the /api/rag/health endpoint."""
    try:
        with _get_conn() as conn:
            count = conn.execute(
                "SELECT COUNT(*) FROM encrypted_chunks"
            ).fetchone()[0]
        return {"status": "ok", "encrypted_chunks": count, "db": str(_DB_PATH)}
    except Exception as exc:
        return {"status": "error", "error": str(exc)}
