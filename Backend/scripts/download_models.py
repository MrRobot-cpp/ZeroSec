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

MODELS_DIR    = Path(__file__).resolve().parents[1] / "models"
_HF_ML_REPO   = os.getenv("HF_MODELS_REPO", "MrRobotcpp/zerosec-ml-models")

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
        "repo_id": _HF_ML_REPO,
        "filename": "pii_pipeline.pkl",
        "local_dir": MODELS_DIR,
        "description": "sklearn Random Forest — PII detection pipeline",
    },
    "advbench_detector": {
        "type": "file",
        "repo_id": _HF_ML_REPO,
        "filename": "advbench_detector.pkl",
        "local_dir": MODELS_DIR,
        "description": "sklearn — AdvBench adversarial prompt detector",
    },
    "audit_anomaly": {
        "type": "file",
        "repo_id": _HF_ML_REPO,
        "filename": "audit_anomaly.pkl",
        "local_dir": MODELS_DIR,
        "description": "sklearn NLP TF-IDF — Isolation Forest anomaly detector",
    },
}


# Registered Ollama models (checked via 'ollama list')
OLLAMA_MODELS = ["nomic-embed-text", "llama2"]


def _is_present(key: str) -> bool:
    """Check whether a model already exists locally."""
    entry = MODELS_REGISTRY[key]
    if entry["type"] == "snapshot":
        # A snapshot is present if the directory exists and has at least model weights
        local = Path(entry["local_dir"])
        return local.exists() and (any(local.glob("*.safetensors")) or any(local.glob("*.bin")))
    else:
        return (Path(entry["local_dir"]) / entry["filename"]).exists()


def ensure_ollama_models() -> None:
    """Ensure required Ollama models are pulled."""
    import subprocess
    
    print("[models] Checking Ollama required models...")
    try:
        # Check running models
        result = subprocess.run(["ollama", "list"], capture_output=True, text=True, check=True)
        present_models = result.stdout.lower()
        
        for model in OLLAMA_MODELS:
            if model not in present_models:
                print(f"  [Pulling] {model} from Ollama (this may take a few minutes)...")
                # We use subprocess.run without check=True to handle cases where 
                # a pull might be in progress or have a transient failure
                subprocess.run(["ollama", "pull", model], check=True)
                print(f"  [done]  {model}")
            else:
                # Silently skip if already present
                pass
    except Exception as e:
        print(f"  [skip] Could not verify/pull Ollama models: {e}")
        print("         Tip: Make sure the Ollama desktop app is running.")


def download_model(key: str, force: bool = False) -> None:
    """Download a single model by registry key."""
    from huggingface_hub import snapshot_download, hf_hub_download

    if key not in MODELS_REGISTRY:
        raise ValueError(f"Unknown model '{key}'. Available: {list(MODELS_REGISTRY)}")

    entry = MODELS_REGISTRY[key]
    present = _is_present(key)

    if present and not force:
        # Silently skip if already present to avoid startup spam
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


def upload_model(key: str) -> None:
    """Upload a local model file to its registered HuggingFace repo."""
    from huggingface_hub import HfApi

    if key not in MODELS_REGISTRY:
        print(f"Error: Unknown model '{key}'")
        return

    entry = MODELS_REGISTRY[key]
    if entry["type"] == "snapshot":
        print(f"Error: Bulk snapshot upload for '{key}' is not implemented here. Use 'huggingface-cli upload'.")
        return

    local_path = Path(entry["local_dir"]) / entry["filename"]
    if not local_path.exists():
        print(f"Error: Local file not found: {local_path}")
        return

    print(f"[upload] Pushing {key} to {entry['repo_id']}...")
    try:
        api = HfApi()
        api.upload_file(
            path_or_fileobj=str(local_path),
            path_in_repo=entry["filename"],
            repo_id=entry["repo_id"],
            commit_message=f"Update {key} model - {datetime.now().strftime('%Y-%m-%d %H:%M')}"
        )
        print(f"[upload] Success! {key} is now on Hugging Face.")
    except Exception as e:
        print(f"[upload] FAILED: {e}")
        print("Tip: Ensure you are logged in with 'huggingface-cli login' and have Write access.")


def download_all(force: bool = False) -> None:
    """Download all registered models (HuggingFace + Ollama)."""
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    
    # 1. Check/Pull Ollama models
    ensure_ollama_models()

    # 2. Check/Pull HuggingFace models
    missing_hf = [k for k in MODELS_REGISTRY if not _is_present(k)]
    if force or missing_hf:
        print(f"[models] Checking {len(MODELS_REGISTRY)} registered HF models...")
        for key in MODELS_REGISTRY:
            download_model(key, force=force)
        print("[models] HF Model check complete.")


def list_models() -> None:
    """Print all registered models and their local status."""
    print(f"\n{'Key':<20} {'Present':<10} {'Description'}")
    print("-" * 70)
    for key, entry in MODELS_REGISTRY.items():
        present = "yes" if _is_present(key) else "no"
        print(f"{key:<20} {present:<10} {entry['description']}")
    print()


if __name__ == "__main__":
    from datetime import datetime
    parser = argparse.ArgumentParser(description="ZeroSec model downloader")
    parser.add_argument("--update", action="store_true", help="Force re-download to pull latest versions")
    parser.add_argument("--upload", type=str, default=None, help="Upload a specific model key to Hugging Face")
    parser.add_argument("--model", type=str, default=None, help="Download/update a specific model only")
    parser.add_argument("--list", action="store_true", help="List all models and local status")
    args = parser.parse_args()

    if args.list:
        list_models()
    elif args.upload:
        upload_model(args.upload)
    elif args.model:
        download_model(args.model, force=args.update)
    else:
        download_all(force=args.update)
