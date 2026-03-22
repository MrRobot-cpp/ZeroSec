"""
ZeroSec ML Classification Module
Provides ML-based injection detection using:
  1. BERT (primary)   — fine-tuned BertForSequenceClassification
  2. AdvBench (secondary) — sklearn TF-IDF + LogisticRegression

PII pipeline is intentionally excluded: the sklearn version mismatch
(saved with 1.8.0, current 1.6.1) makes it produce unreliable results.
PII redaction is handled by the regex layer in firewall.py.

Models are loaded lazily on first call and cached as module-level singletons.
"""

from __future__ import annotations

import logging
import warnings
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# -------------------------
# PATHS
# -------------------------
_MODELS_DIR = Path(__file__).resolve().parents[1] / "models"
_BERT_DIR = _MODELS_DIR / "bert_prompt_injection_model"
_ADVBENCH_PKL = _MODELS_DIR / "advbench_detector.pkl"

# -------------------------
# THRESHOLDS
# -------------------------
# BERT standalone threshold: block without needing AdvBench confirmation.
# Set high (0.93) because BERT over-fires on security-topic questions
# (e.g. "describe social engineering attacks" = 0.90 — legitimate query).
# At 0.93+ the model is highly confident it's an actual injection command.
BERT_BLOCK_THRESHOLD = 0.93

# BERT "soft" zone: if score is in (BERT_SOFT_MIN, BERT_BLOCK_THRESHOLD)
# and AdvBench ALSO says HARMFUL, block (both models must agree).
# This catches moderately-phrased injections ("how to bypass firewall rules").
BERT_SOFT_MIN = 0.75

# -------------------------
# MODULE-LEVEL SINGLETONS (lazy)
# -------------------------
_bert_tokenizer = None
_bert_model = None
_advbench_data = None

_bert_available: Optional[bool] = None
_advbench_available: Optional[bool] = None


# -------------------------
# LOADERS
# -------------------------
def _load_bert() -> bool:
    """Load BERT tokenizer + model. Returns True on success."""
    global _bert_tokenizer, _bert_model, _bert_available
    if _bert_available is not None:
        return _bert_available

    if not _BERT_DIR.exists():
        logger.warning("[classification] BERT model dir not found: %s", _BERT_DIR)
        _bert_available = False
        return False

    try:
        import torch  # noqa: F401 — confirm torch is present
        from transformers import BertForSequenceClassification, BertTokenizer

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            _bert_tokenizer = BertTokenizer.from_pretrained(str(_BERT_DIR))
            _bert_model = BertForSequenceClassification.from_pretrained(str(_BERT_DIR))
            _bert_model.eval()

        _bert_available = True
        logger.info("[classification] BERT model loaded from %s", _BERT_DIR)
    except Exception as exc:  # pylint: disable=broad-except
        logger.warning("[classification] BERT load failed: %s", exc)
        _bert_available = False

    return _bert_available


def _load_advbench() -> bool:
    """Load AdvBench sklearn detector. Returns True on success."""
    global _advbench_data, _advbench_available
    if _advbench_available is not None:
        return _advbench_available

    if not _ADVBENCH_PKL.exists():
        logger.warning("[classification] AdvBench pkl not found: %s", _ADVBENCH_PKL)
        _advbench_available = False
        return False

    try:
        import joblib

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            _advbench_data = joblib.load(str(_ADVBENCH_PKL))

        _advbench_available = True
        logger.info("[classification] AdvBench model loaded (accuracy=%.3f)", _advbench_data.get("accuracy", 0))
    except Exception as exc:  # pylint: disable=broad-except
        logger.warning("[classification] AdvBench load failed: %s", exc)
        _advbench_available = False

    return _advbench_available


# -------------------------
# PRIVATE INFERENCE
# -------------------------
def _bert_score(text: str) -> float:
    """Return HARMFUL probability [0, 1] from BERT. -1 if unavailable."""
    if not _load_bert():
        return -1.0
    try:
        import torch

        inputs = _bert_tokenizer(
            text,
            return_tensors="pt",
            truncation=True,
            max_length=512,
            padding=False,
        )
        with torch.no_grad():
            logits = _bert_model(**inputs).logits
        probs = torch.softmax(logits, dim=-1)[0]
        return float(probs[1])  # index 1 = HARMFUL
    except Exception as exc:  # pylint: disable=broad-except
        logger.debug("[classification] BERT inference error: %s", exc)
        return -1.0


def _advbench_predict(text: str) -> tuple[int, float]:
    """
    Run AdvBench classifier.
    Returns (label, decision_score) where label is 0=SAFE / 1=HARMFUL.
    decision_score > 0 means HARMFUL.
    Returns (-1, 0.0) if unavailable.
    """
    if not _load_advbench():
        return -1, 0.0
    try:
        vec = _advbench_data["vectorizer"]
        mdl = _advbench_data["model"]
        X = vec.transform([text])
        label = int(mdl.predict(X)[0])
        try:
            score = float(mdl.decision_function(X)[0])
        except Exception:
            score = float(label)  # fallback: 0 or 1
        return label, score
    except Exception as exc:  # pylint: disable=broad-except
        logger.debug("[classification] AdvBench inference error: %s", exc)
        return -1, 0.0


# -------------------------
# PUBLIC API
# -------------------------
def classify_injection(text: str) -> tuple[bool, float, str]:
    """
    Classify whether `text` is a prompt injection / adversarial attack.

    Detection logic (layered):
      1. BERT harmful > BERT_BLOCK_THRESHOLD  →  BLOCK (high confidence)
      2. BERT in soft zone AND AdvBench=HARMFUL  →  BLOCK (both models agree)
      3. Neither model available  →  (False, 0.0, 'unavailable')

    Returns:
        (is_injection: bool, confidence: float, model_name: str)
        confidence is the BERT harmful probability (or AdvBench decision score normalised to [0,1])
    """
    if not text or not text.strip():
        return False, 0.0, "none"

    bert_prob = _bert_score(text)
    adv_label, adv_score = _advbench_predict(text)

    # --- Primary: BERT alone is decisive ---
    if bert_prob >= BERT_BLOCK_THRESHOLD:
        return True, bert_prob, "bert"

    # --- Secondary: BERT uncertain + AdvBench confirms ---
    if bert_prob >= BERT_SOFT_MIN and adv_label == 1:
        # Blend the two scores for the confidence value
        confidence = (bert_prob + min(adv_score / 10.0, 1.0)) / 2
        return True, confidence, "bert+advbench"

    # --- AdvBench standalone (BERT unavailable or very low score) ---
    if bert_prob < 0 and adv_label == 1 and adv_score > 5.0:
        # Only trust AdvBench alone when signal is very strong (df > 5)
        return True, min(adv_score / 15.0, 0.95), "advbench"

    return False, max(bert_prob, 0.0), "none"


def get_model_status() -> dict:
    """Return availability status of both ML models (for health checks / UI)."""
    return {
        "bert": {
            "available": _load_bert(),
            "path": str(_BERT_DIR),
        },
        "advbench": {
            "available": _load_advbench(),
            "path": str(_ADVBENCH_PKL),
        },
    }
