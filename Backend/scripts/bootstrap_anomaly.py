"""
One-shot script: inject synthetic audit logs + train the anomaly model.

Usage:
    python -m backend.scripts.bootstrap_anomaly
    python -m backend.scripts.bootstrap_anomaly --org-id 1 --n-normal 200 --n-anomalous 30
"""

from __future__ import annotations

import argparse
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))


def main():
    parser = argparse.ArgumentParser(description="Inject synthetic audit data and train anomaly model")
    parser.add_argument("--org-id",      type=int, default=1,   help="Organization ID (default: 1)")
    parser.add_argument("--n-normal",    type=int, default=150, help="Normal events to inject (default: 150)")
    parser.add_argument("--n-anomalous", type=int, default=20,  help="Anomalous events to inject (default: 20)")
    args = parser.parse_args()

    from backend.app import app

    with app.app_context():
        from backend.database.models import User
        from backend.scripts.generate_synthetic_audit import generate_and_insert
        from backend.security.anomaly_detection import get_detector

        # --- Step 1: resolve user IDs ---
        users = User.query.filter_by(organization_id=args.org_id).all()
        if not users:
            print(f"[!] No users found for org_id={args.org_id} — using placeholder IDs [1, 2, 3]")
            user_ids = [1, 2, 3]
        else:
            user_ids = [u.user_id for u in users]
            print(f"[+] Found {len(user_ids)} user(s) for org {args.org_id}")

        # --- Step 2: inject synthetic events ---
        print(f"[*] Injecting {args.n_normal} normal + {args.n_anomalous} anomalous events...")
        result = generate_and_insert(
            args.org_id, user_ids,
            n_normal=args.n_normal,
            n_anomalous=args.n_anomalous,
        )
        print(f"[+] Inserted {result['inserted']} rows  "
              f"({result['normal']} normal, {result['anomalous']} anomalous)")

        # --- Step 3: check model status ---
        # NLP model is trained offline via backend/experiments/train_anomaly.ipynb.
        # This script only injects training data — the pickle must be built separately.
        detector = get_detector()
        status   = detector.get_status()

        if status.get("model_ready"):
            print(f"[+] NLP anomaly model loaded: {status.get('best_model')} "
                  f"(trained on {status.get('trained_on')} samples)")
            print("[✓] Anomaly model ready — next red-team run will include a Layer 2 verdict.")
        else:
            print("[!] No trained model found at backend/models/audit_anomaly.pkl")
            print("    Run the training notebook to build the model:")
            print("    backend/experiments/train_anomaly.ipynb")
            print("    The synthetic data injected above will be used for training.")


if __name__ == "__main__":
    main()
