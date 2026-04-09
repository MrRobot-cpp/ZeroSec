"""
ZeroSec SAG Crypto — Encryption Primitives
AES-256-GCM, HKDF-SHA256, HMAC-SHA256, SHA-256

All keys are document-scoped and derived on demand via HKDF.
No keys are stored anywhere — only the master SECRET_KEY in config.
"""

import os
import hmac
import hashlib
import logging

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes
from cryptography.exceptions import InvalidTag

_log = logging.getLogger("zerosec.crypto")

# GCM nonce size (NIST SP 800-38D recommendation)
NONCE_SIZE = 12   # bytes
# AES-256 key size
KEY_SIZE   = 32   # bytes
# HKDF info string — change this to invalidate all derived keys
_HKDF_INFO = b"zerosec-sag-v3"


# -------------------------
# KEY DERIVATION
# -------------------------

def derive_key(secret_key: str, doc_id: str, clearance: str, key_version: int = 1) -> bytes:
    """
    Derive a 256-bit AES key scoped to a specific document.

    key = HKDF-SHA256(
        ikm  = SECRET_KEY,
        salt = f"{doc_id}:{clearance}:v{key_version}",
        info = "zerosec-sag-v3",
        len  = 32
    )

    Document-scoped so:
    - User deletion/role change has zero impact on derived keys
    - Each document gets a unique key — key compromise is limited blast radius
    - key_version allows rotation without re-deriving the same key
    """
    if not secret_key:
        raise ValueError("SECRET_KEY must be set for encrypted pipeline")

    salt = f"{doc_id}:{clearance}:v{key_version}".encode()

    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=KEY_SIZE,
        salt=salt,
        info=_HKDF_INFO,
    )
    return hkdf.derive(secret_key.encode())


# -------------------------
# AES-256-GCM ENCRYPT / DECRYPT
# -------------------------

def encrypt(plaintext: bytes, key: bytes) -> tuple[bytes, bytes, bytes]:
    """
    Encrypt plaintext with AES-256-GCM.

    Returns (ciphertext, nonce, auth_tag).
    auth_tag is the last 16 bytes of the AESGCM output — stored separately
    in enc_store so HMAC can cover it independently.

    Nonce is always os.urandom(12) — never reused, never incremented.
    """
    nonce = os.urandom(NONCE_SIZE)
    aesgcm = AESGCM(key)
    # AESGCM.encrypt() returns ciphertext + 16-byte tag appended
    ct_with_tag = aesgcm.encrypt(nonce, plaintext, None)
    # Split: last 16 bytes are the GCM auth tag
    ciphertext = ct_with_tag[:-16]
    auth_tag   = ct_with_tag[-16:]
    return ciphertext, nonce, auth_tag


def decrypt(ciphertext: bytes, nonce: bytes, auth_tag: bytes, key: bytes) -> bytes:
    """
    Decrypt AES-256-GCM ciphertext.

    Raises cryptography.exceptions.InvalidTag if authentication fails —
    caller must treat this as a tamper/corruption event, not just a bad key.
    """
    aesgcm = AESGCM(key)
    ct_with_tag = ciphertext + auth_tag
    return aesgcm.decrypt(nonce, ct_with_tag, None)


# -------------------------
# HMAC-SHA256 ROW INTEGRITY
# -------------------------

def compute_hmac(
    chunk_id: str,
    ciphertext: bytes,
    auth_tag: bytes,
    filename: str,
    clearance: str,
    doc_id: str,
    key_version: int,
    hmac_salt: str,
) -> bytes:
    """
    Compute HMAC-SHA256 over all row fields.

    Covers chunk_id + ciphertext + auth_tag + filename + clearance +
    doc_id + key_version so that tampering with ANY field is detected.
    hmac_salt is a separate secret from the encryption key (SAG_HMAC_SALT in config).
    """
    h = hmac.new(hmac_salt.encode(), digestmod=hashlib.sha256)
    h.update(chunk_id.encode())
    h.update(ciphertext)
    h.update(auth_tag)
    h.update(filename.encode())
    h.update(clearance.encode())
    h.update(doc_id.encode())
    h.update(str(key_version).encode())
    return h.digest()


def verify_hmac(
    expected: bytes,
    chunk_id: str,
    ciphertext: bytes,
    auth_tag: bytes,
    filename: str,
    clearance: str,
    doc_id: str,
    key_version: int,
    hmac_salt: str,
) -> bool:
    """
    Constant-time HMAC verification.
    Returns False if the row has been tampered with.
    """
    actual = compute_hmac(
        chunk_id, ciphertext, auth_tag, filename,
        clearance, doc_id, key_version, hmac_salt
    )
    return hmac.compare_digest(expected, actual)


# -------------------------
# SHA-256 CHUNK ID
# -------------------------

def chunk_id(filename: str, index: int) -> str:
    """
    Collision-resistant chunk pointer: SHA-256(filename:index).
    Used as the primary key in enc_store and as Chroma metadata.
    """
    raw = f"{filename}:{index}".encode()
    return hashlib.sha256(raw).hexdigest()
