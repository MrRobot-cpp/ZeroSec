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
        from backend.utils.audit import get_audit_logs

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

        # --- Step 3: train the model ---
        print("[*] Training anomaly model on audit logs...")
        logs = get_audit_logs(organization_id=args.org_id, limit=10_000)
        print(f"    Training on {len(logs)} total audit log entries")

        detector = get_detector()
        train_result = detector.train(logs)

        status = train_result.get("status")
        if status == "cold_start":
            current = train_result.get("current", 0)
            minimum = train_result.get("min_required", 50)
            print(f"[!] Cold start — only {current} logs, need {minimum}. Re-run with more --n-normal.")
            sys.exit(1)
        elif status == "error":
            print(f"[!] Training error: {train_result.get('message')}")
            sys.exit(1)

        print(f"[+] Model trained: {train_result.get('best_model')} "
              f"on {train_result.get('trained_on')} windows")

        evaluation = train_result.get("evaluation", {})
        for model_name, metrics in evaluation.items():
            f1  = metrics.get("f1", 0)
            auc = metrics.get("roc_auc", 0)
            print(f"    {model_name:22s}  F1={f1:.4f}  AUC={auc:.4f}")

        best = train_result.get("best_model")
        print(f"\n[✓] Done. Selected model: {best}")
        print("[✓] Anomaly model ready — next red-team run will include a Layer 2 verdict.")


if __name__ == "__main__":
    main()
