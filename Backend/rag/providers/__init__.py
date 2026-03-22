import os
from backend.rag.providers.base import BaseRAGProvider

_provider: BaseRAGProvider | None = None


def _load_config_from_db() -> dict:
    """
    Query the Policy table for a rag_provider policy.
    Returns the config dict, or {} if none found.
    Falls back gracefully if called outside app context.
    """
    try:
        from backend.database.repository import PolicyRepository
        from backend.database.models import Organization
        org = Organization.query.first()
        if not org:
            return {}
        policies = PolicyRepository.get_policies_by_type(org.organization_id, "rag_provider")
        if policies and policies[0].enabled and policies[0].config:
            return policies[0].config
    except Exception:
        pass
    return {}


def get_provider() -> BaseRAGProvider:
    """
    Return the singleton RAG provider instance.
    DB config takes precedence over environment variables.
    Falls back to env vars if no DB config is saved.

    provider=local (default): Ollama + Chroma, no external API keys needed.
    provider=external: Groq (LLM) + sentence-transformers (embeddings) + Qdrant Cloud.
    provider=hybrid: Groq (LLM) + sentence-transformers (embeddings) + Chroma (local).
    """
    global _provider
    if _provider is None:
        db_config = _load_config_from_db()
        mode = (db_config.get("provider") or os.getenv("RAG_PROVIDER", "local")).lower()
        if mode == "external":
            _validate_external_config(db_config)
            from backend.rag.providers.external_provider import ExternalRAGProvider
            _provider = ExternalRAGProvider(config=db_config)
        elif mode == "hybrid":
            _validate_hybrid_config(db_config)
            from backend.rag.providers.hybrid_provider import HybridRAGProvider
            _provider = HybridRAGProvider(config=db_config)
        else:
            from backend.rag.providers.local_provider import LocalRAGProvider
            _provider = LocalRAGProvider()
    return _provider


def reset_provider() -> None:
    """Force re-initialization of the provider singleton on next call to get_provider()."""
    global _provider
    _provider = None


def _validate_external_config(config: dict) -> None:
    """Check that Groq and Qdrant credentials are available (DB config or env vars)."""
    missing = []
    if not (config.get("groq_api_key") or os.getenv("GROQ_API_KEY")):
        missing.append("groq_api_key")
    if not (config.get("qdrant_url") or os.getenv("QDRANT_URL")):
        missing.append("qdrant_url")
    if not (config.get("qdrant_api_key") or os.getenv("QDRANT_API_KEY")):
        missing.append("qdrant_api_key")
    if missing:
        raise ValueError(
            f"External RAG provider requires: {', '.join(missing)}. "
            "Configure them in Settings → Integrations → RAG Provider."
        )


def _validate_hybrid_config(config: dict) -> None:
    """Check that Groq API key is available (DB config or env vars)."""
    if not (config.get("groq_api_key") or os.getenv("GROQ_API_KEY")):
        raise ValueError(
            "Hybrid RAG provider requires: groq_api_key. "
            "Configure it in Settings → Integrations → RAG Provider."
        )
