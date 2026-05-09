"""
Re-save .pkl model files with the currently installed scikit-learn version.

Run once to eliminate InconsistentVersionWarning at startup:
    python -m backend.scripts.resave_models
"""
import warnings
from pathlib import Path

import joblib
from sklearn.exceptions import InconsistentVersionWarning

MODELS_DIR = Path(__file__).resolve().parents[1] / "models"

PKL_FILES = [
    "pii_pipeline.pkl",
    "advbench_detector.pkl",
    "audit_anomaly.pkl",
]


def resave(path: Path) -> None:
    if not path.exists():
        print(f"  [skip] {path.name} — not found")
        return
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", InconsistentVersionWarning)
        obj = joblib.load(path)
    joblib.dump(obj, path)
    print(f"  [ok]   {path.name} re-saved")


if __name__ == "__main__":
    import sklearn
    print(f"scikit-learn {sklearn.__version__} — re-saving models in {MODELS_DIR}\n")
    for name in PKL_FILES:
        resave(MODELS_DIR / name)
    print("\nDone. Restart the backend to confirm warnings are gone.")
