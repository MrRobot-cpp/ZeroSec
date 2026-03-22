"""
ZeroSec Model Downloader
Downloads all ML/DL models from HuggingFace Hub.

Usage:
    # Download missing models (first-time setup)
    python -m backend.scripts.download_models

    # Pull latest versions of all models (update)
    python -m backend.scripts.download_models --update

    # Update a specific model only
    python -m backend.scripts.download_models --update --model bert_injection

    # List all registered models and their local status
    python -m backend.scripts.download_models --list

Adding a new model:
    Add an entry to MODELS_REGISTRY below. Two types:
    - "snapshot": full HF model repo (directory with config.json, weights, tokenizer, etc.)
    - "file": single file from a HF repo
"""

import os
import argparse
from pathlib import Path

MODELS_DIR = Path(__file__).resolve().parents[1] / "models"

# ---------------------------------------------------------------------------
# MODELS REGISTRY
# Add new models here. "repo_id" must match the HuggingFace Hub repo you
# uploaded to. Bump the repo or use tags/branches for explicit versioning.
# ---------------------------------------------------------------------------
MODELS_REGISTRY: dict = {
    "bert_injection": {
        "type": "snapshot",
        "repo_id": os.getenv("HF_BERT_REPO", "MrRobotcpp/zerosec-bert-injection-detector"),
        "local_dir": MODELS_DIR / "bert_prompt_injection_model",
        "ignore_patterns": ["checkpoint-*"],
        "description": "Fine-tuned BERT — prompt injection detection (primary detector)",
    },
    "pii_pipeline": {
        "type": "file",
        "repo_id": os.getenv("HF_MODELS_REPO", "MrRobotcpp/zerosec-ml-models"),
        "filename": "pii_pipeline.pkl",
        "local_dir": MODELS_DIR,
        "description": "sklearn Random Forest — PII detection pipeline",
    },
    "advbench_detector": {
        "type": "file",
        "repo_id": os.getenv("HF_MODELS_REPO", "MrRobotcpp/zerosec-ml-models"),
        "filename": "advbench_detector.pkl",
        "local_dir": MODELS_DIR,
        "description": "sklearn — AdvBench adversarial prompt detector",
    },
}


def _is_present(key: str) -> bool:
    """Check whether a model already exists locally."""
    entry = MODELS_REGISTRY[key]
    if entry["type"] == "snapshot":
        # A snapshot is present if the directory exists and has at least model weights
        local = Path(entry["local_dir"])
        return local.exists() and (any(local.glob("*.safetensors")) or any(local.glob("*.bin")))
    else:
        return (Path(entry["local_dir"]) / entry["filename"]).exists()


def download_model(key: str, force: bool = False) -> None:
    """Download a single model by registry key."""
    from huggingface_hub import snapshot_download, hf_hub_download

    if key not in MODELS_REGISTRY:
        raise ValueError(f"Unknown model '{key}'. Available: {list(MODELS_REGISTRY)}")

    entry = MODELS_REGISTRY[key]
    present = _is_present(key)

    if present and not force:
        print(f"  [skip] {key} — already present locally")
        return

    action = "Updating" if present else "Downloading"
    print(f"  [{action}] {key}: {entry['description']}")
    print(f"           repo: {entry['repo_id']}")

    Path(entry["local_dir"]).mkdir(parents=True, exist_ok=True)

    if entry["type"] == "snapshot":
        snapshot_download(
            repo_id=entry["repo_id"],
            local_dir=str(entry["local_dir"]),
            ignore_patterns=entry.get("ignore_patterns", []),
            force_download=force,
        )
    else:
        hf_hub_download(
            repo_id=entry["repo_id"],
            filename=entry["filename"],
            local_dir=str(entry["local_dir"]),
            force_download=force,
        )

    print(f"  [done]  {key}")


def download_all(force: bool = False) -> None:
    """Download all registered models."""
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    print(f"[models] Target directory: {MODELS_DIR}")
    print(f"[models] {'Updating' if force else 'Checking'} {len(MODELS_REGISTRY)} registered model(s)...")

    for key in MODELS_REGISTRY:
        download_model(key, force=force)

    print("[models] Done.")


def list_models() -> None:
    """Print all registered models and their local status."""
    print(f"\n{'Key':<20} {'Present':<10} {'Description'}")
    print("-" * 70)
    for key, entry in MODELS_REGISTRY.items():
        present = "yes" if _is_present(key) else "no"
        print(f"{key:<20} {present:<10} {entry['description']}")
    print()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ZeroSec model downloader")
    parser.add_argument("--update", action="store_true", help="Force re-download to pull latest versions")
    parser.add_argument("--model", type=str, default=None, help="Download/update a specific model only")
    parser.add_argument("--list", action="store_true", help="List all models and local status")
    args = parser.parse_args()

    if args.list:
        list_models()
    elif args.model:
        download_model(args.model, force=args.update)
    else:
        download_all(force=args.update)
