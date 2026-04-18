"""
ZeroSec /secure-query Endpoint
Isolated encrypted RAG pipeline for HIGH sensitivity documents.

Guards (in order):
  1. JWT required
  2. Full security pipeline — firewall, canary, PII (identical to /query)
  3. SecureRAGProvider — decrypt chunks in memory, never store plaintext
"""

import logging, datetime
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity

from backend.rag.secure_provider import SecureRAGProvider
from backend.rag.prompt_builder import (
    build_safe_context,
    build_prompt,
    clean_rag_output,
    preprocess_query,
)
from backend.security import firewall
from backend.services.logging_service import log_decision
from backend.utils.audit import log_audit

_log = logging.getLogger("zerosec.secure_query")

secure_query_bp = Blueprint("secure_query", __name__, url_prefix="/api")

# Module-level provider singleton — initialised on first request
_secure_provider: SecureRAGProvider | None = None


def _get_secure_provider() -> SecureRAGProvider:
    """
    Lazy singleton. Reads SECRET_KEY and SAG_HMAC_SALT from Flask app config.
    Raises ValueError if config is missing or insecure.
    """
    global _secure_provider
    if _secure_provider is None:
        secret_key = current_app.config.get("SECRET_KEY", "")
        hmac_salt  = current_app.config.get("SAG_HMAC_SALT", "")
        _secure_provider = SecureRAGProvider(
            secret_key=secret_key,
            hmac_salt=hmac_salt,
        )
    return _secure_provider


def _log_security_event(org_id, user_id, action, reason, query, score):
    """Persist a security block — mirrors rag_service._log_security_event."""
    try:
        from backend.database.repository import SecurityRepository
        SecurityRepository.log_firewall_block(
            organization_id=org_id or 1,
            user_id=user_id,
            action=action,
            reason=reason,
            query=query,
            score=score,
        )
    except Exception as exc:
        _log.debug("[secure_query] DB security log skipped: %s", exc)


@secure_query_bp.route("/secure-query", methods=["POST"])
@jwt_required()
def secure_query():
    """
    Encrypted RAG query endpoint.
    Uses SecureRAGProvider — decrypted content never persisted.
    """
    user_id = get_jwt_identity()

    # ------------------------------------------------------------------
    # Parse input
    # ------------------------------------------------------------------
    data     = request.get_json(force=True)
    question = (data.get("question") or "").strip()

    if not question:
        return jsonify({"decision": "BLOCK", "reason": "empty_query", "sources": []}), 400

    org_id = None
    try:
        from flask_jwt_extended import get_jwt
        org_id = get_jwt().get("organization_id")
    except Exception:
        pass

    # ------------------------------------------------------------------
    # Security pipeline — identical to /query
    # ------------------------------------------------------------------

    # Input firewall
    # isoformat() on a tz-aware datetime already yields "+00:00"; don't append "Z".
    now = datetime.datetime.now(datetime.timezone.utc)
    timestamp_str = now.isoformat()

    inj, inj_score = firewall.detect_injection(question)
    if inj:
        _log_security_event(org_id, user_id, "firewall_injection_block",
                            "prompt_injection", question, inj_score)
        log_audit(
            organization_id=org_id or 1,
            user_id=user_id,
            action="firewall_injection_block",
            target_type="SecureQuery",
            metadata={"query": question[:200], "score": inj_score},
            created_at=now
        )
        log_decision(question, {
            "decision": "BLOCK",
            "reason": "Firewall — Prompt Injection (encrypted pipeline)",
            "stopped_by": "Regex + ML Firewall",
        }, timestamp=timestamp_str)
        return jsonify({
            "decision": "BLOCK",
            "reason": "Firewall — Prompt Injection",
            "stopped_by": "Regex + ML Firewall",
            "answer": "SECURITY ALERT: This request has been blocked by ZeroSec.",
            "sources": [],
        })

    # Canary token check on query
    if firewall._check_canary_tokens(question):
        _log_security_event(org_id, user_id, "firewall_canary_block",
                            "canary_token_detected", question, 1.0)
        log_audit(
            organization_id=org_id or 1,
            user_id=user_id,
            action="firewall_canary_block",
            target_type="SecureQuery",
            metadata={"query": question[:200]},
        )
        log_decision(question, {
            "decision": "BLOCK",
            "reason": "Firewall — Canary Token in Query (encrypted pipeline)",
            "stopped_by": "Canary Detection",
        })
        return jsonify({
            "decision": "BLOCK",
            "reason": "Firewall — Canary Token in Query",
            "stopped_by": "Canary Detection",
            "answer": "ACCESS DENIED: Canary token detected in query.",
            "sources": [],
        })

    # ------------------------------------------------------------------
    # Encrypted retrieval
    # ------------------------------------------------------------------
    try:
        provider = _get_secure_provider()
    except ValueError as exc:
        _log.error("[secure_query] provider init failed: %s", exc)
        return jsonify({"decision": "BLOCK", "reason": str(exc)}), 503

    processed_query = preprocess_query(question)
    try:
        results = provider.retrieve(processed_query)
    except Exception as exc:
        _log.error("[secure_query] retrieval failed: %s", exc)
        error_msg = str(exc)
        # Provide actionable guidance for common vector DB errors
        if "no such table" in error_msg or "database" in error_msg.lower():
            reason = "Encrypted vector database needs re-initialization. Please restart the backend."
        else:
            reason = f"Retrieval error: {error_msg}"
        return jsonify({
            "decision": "BLOCK",
            "reason": reason,
            "sources": [],
        }), 500

    if not results:
        log_audit(
            organization_id=org_id or 1,
            user_id=user_id,
            action="encrypted_query",
            target_type="SecureQuery",
            metadata={"query": question[:200], "sources_count": 0, "result": "no_results"},
        )
        log_decision(question, {"decision": "ALLOW", "reason": "encrypted_pipeline — no matching chunks"})
        return jsonify({
            "decision": "ALLOW",
            "answer": "No HIGH sensitivity documents found for your query.",
            "sources": [],
        })

    results_with_scores = [(r.document, r.similarity_score) for r in results]
    docs = [doc for doc, _ in results_with_scores]

    # ------------------------------------------------------------------
    # Context building with security filters (PII, canary, injection)
    # ------------------------------------------------------------------
    context, used_sources, blocked_reason, removed_chunks = build_safe_context(
        docs, query=question, org_id=org_id, user_id=user_id, strip_preview=True
    )

    for removed in removed_chunks:
        reason   = removed.get("reason", "security_filter")
        filename = removed.get("filename", "unknown")
        log_decision(question, {
            "decision": "BLOCK",
            "reason": f"Encrypted pipeline — {reason} in {filename}",
            "stopped_by": "Regex + ML Firewall",
        })

    # Add relevance scores to sources
    score_map = {doc.metadata.get("filename", ""): score for doc, score in results_with_scores}
    for source in used_sources:
        if source.get("filename") in score_map:
            source["relevance_score"] = round(score_map[source["filename"]], 3)

    if "[No relevant context found]" in context:
        return jsonify({
            "decision": "ALLOW",
            "answer": "Found encrypted documents but no usable context. Try rephrasing.",
            "sources": [],
        })

    # ------------------------------------------------------------------
    # LLM generation
    # ------------------------------------------------------------------
    prompt = build_prompt(context, question)

    try:
        generation = provider.generate(prompt)
        raw_answer = generation.raw_text
        answer     = clean_rag_output(raw_answer)
    except Exception as exc:
        return jsonify({
            "decision": "BLOCK",
            "reason": f"llm_error: {exc}",
            "sources": used_sources,
        })

    if not answer:
        return jsonify({
            "decision": "ALLOW",
            "answer": "Unable to generate a response. Please try again.",
            "sources": used_sources,
        })

    # ------------------------------------------------------------------
    # Output security — jailbreak + PII redaction (two passes)
    # ------------------------------------------------------------------
    is_jailbreak, jailbreak_reason = firewall.inspect_llm_output(answer)
    if is_jailbreak:
        return jsonify({
            "decision": "BLOCK",
            "reason": f"Jailbreak — {jailbreak_reason}",
            "stopped_by": "Output Firewall",
            "answer": "SECURITY ALERT: Response blocked by ZeroSec output firewall.",
            "sources": [],
        })

    final_answer = firewall.redact_pii(answer)

    # ------------------------------------------------------------------
    # Audit log — decryption event
    # ------------------------------------------------------------------
    log_audit(
        organization_id=org_id or 1,
        user_id=user_id,
        action="encrypted_query",
        target_type="SecureQuery",
        metadata={
            "query":            question[:200],
            "sources_count":    len(used_sources),
            "chunks_decrypted": len(docs),
            "chunks_filtered":  len(removed_chunks),
        },
        created_at=now
    )
    log_decision(question, {
        "decision": "ALLOW",
        "reason":   "encrypted_pipeline",
        "sources":  [s.get("filename") for s in used_sources],
    }, timestamp=timestamp_str)

    return jsonify({
        "decision": "ALLOW",
        "answer":   final_answer,
        "sources":  used_sources,
        "provider": "secure_local",
    })
