"""
Synthetic Audit Log Generator

Generates realistic audit events for training and demo purposes.
Also callable as a standalone script:

    python -m backend.scripts.generate_synthetic_audit --org-id 1

Two cohorts are created:

Normal (default 150 events):
  - Weekdays 08:00–18:00, realistic action distribution
  - Inter-event gaps of 5–120 minutes
  - Spread over the last 30 days

Anomalous (default 20 events, 4 patterns × 5 events):
  1. Off-hours access     — user_login + clearance_access_denied at 02:00–04:00
  2. Velocity burst       — 5× documents_listed within 3 minutes (exfiltration)
  3. Impossible sequence  — document_uploaded by user with no prior activity
  4. Weekend privilege    — document_uploaded on Saturday 23:00

All rows inserted with meta_data.synthetic=True and meta_data.anomaly_type set
(for anomalous events) so you can cross-reference ground truth vs. model scores.
"""

from __future__ import annotations

import argparse
import random
from datetime import datetime, timedelta, timezone


# ---------------------------------------------------------------------------
# Action pools
# ---------------------------------------------------------------------------

_NORMAL_ACTIONS = [
    ('user_login',        3.0),
    ('user_logout',       2.5),
    ('documents_listed',  2.0),
    ('document_uploaded', 1.0),
    ('document_deleted',  0.3),
    ('role_assigned',     0.2),
]

_TOTAL_WEIGHT = sum(w for _, w in _NORMAL_ACTIONS)
_NORMAL_ACTION_LIST  = [a for a, _ in _NORMAL_ACTIONS]
_NORMAL_ACTION_PROBS = [w / _TOTAL_WEIGHT for _, w in _NORMAL_ACTIONS]


def _weighted_choice(actions, probs):
    r = random.random()
    cumulative = 0.0
    for action, prob in zip(actions, probs):
        cumulative += prob
        if r <= cumulative:
            return action
    return actions[-1]


# ---------------------------------------------------------------------------
# Normal event generator
# ---------------------------------------------------------------------------

def generate_normal_events(org_id: int, user_ids: list[int], n: int = 150) -> list[dict]:
    """
    Generate n normal audit events spread over the last 30 days.
    All events fall on weekdays between 08:00 and 18:00 local time.
    """
    events = []
    now = datetime.now(timezone.utc)

    # Start 30 days ago
    cursor = now - timedelta(days=30)

    for _ in range(n):
        # Advance by a random business-hours gap (5–120 minutes)
        gap = random.randint(5, 120)
        cursor += timedelta(minutes=gap)

        # Skip to next weekday 08:00 if we landed outside business hours
        while cursor.weekday() >= 5 or not (8 <= cursor.hour < 18):
            if cursor.weekday() >= 5:
                days_ahead = 7 - cursor.weekday()
                cursor += timedelta(days=days_ahead)
                cursor = cursor.replace(hour=8, minute=0, second=0, microsecond=0)
            elif cursor.hour < 8:
                cursor = cursor.replace(hour=8, minute=random.randint(0, 59), second=0)
            else:
                cursor += timedelta(days=1)
                cursor = cursor.replace(hour=8, minute=random.randint(0, 59), second=0)

        if cursor > now:
            break

        action  = _weighted_choice(_NORMAL_ACTION_LIST, _NORMAL_ACTION_PROBS)
        user_id = random.choice(user_ids)
        events.append({
            'organization_id': org_id,
            'user_id':         user_id,
            'action':          action,
            'target_type':     'Document' if 'document' in action else 'User',
            'target_id':       random.randint(1, 50) if 'document' in action else user_id,
            'meta_data':       {'synthetic': True, 'anomaly_type': None},
            'created_at':      cursor,
        })

    return events


# ---------------------------------------------------------------------------
# Anomalous event generator  (4 patterns × 5 events)
# ---------------------------------------------------------------------------

def generate_anomalous_events(org_id: int, user_ids: list[int], n: int = 20) -> list[dict]:
    """
    Generate n anomalous events using 4 distinct patterns.
    n is rounded down to the nearest multiple of 4.
    """
    per_pattern = max(1, n // 4)
    now         = datetime.now(timezone.utc)
    events      = []

    # --- Pattern 1: Off-hours access ---
    base = now - timedelta(days=random.randint(1, 7))
    base = base.replace(hour=random.randint(2, 3), minute=random.randint(0, 59), second=0)
    for i in range(per_pattern):
        ts     = base + timedelta(minutes=i * 15)
        action = 'clearance_access_denied' if i % 2 == 0 else 'user_login'
        events.append({
            'organization_id': org_id,
            'user_id':         random.choice(user_ids),
            'action':          action,
            'target_type':     'Document',
            'target_id':       random.randint(1, 50),
            'meta_data':       {
                'synthetic':    True,
                'anomaly_type': 'off_hours_access',
            },
            'created_at': ts,
        })

    # --- Pattern 2: Velocity burst (exfiltration simulation) ---
    # Was: 5 events in 2 min — too subtle, model couldn't separate from normal.
    # Now: 40 events in 30 seconds — extreme burst, clearly separable.
    base = now - timedelta(days=random.randint(1, 5))
    base = base.replace(hour=random.randint(10, 15), minute=0, second=0)
    user = random.choice(user_ids)
    burst_count = max(per_pattern * 8, 40)   # 40+ events regardless of per_pattern
    for i in range(burst_count):
        ts = base + timedelta(seconds=i * 0.75)   # 40 events in 30 seconds
        events.append({
            'organization_id': org_id,
            'user_id':         user,
            'action':          'documents_listed',
            'target_type':     'Document',
            'target_id':       random.randint(1, 50),
            'meta_data':       {
                'synthetic':    True,
                'anomaly_type': 'velocity_burst',
            },
            'created_at': ts,
        })

    # --- Pattern 3: Impossible sequence (document upload by unknown user) ---
    # Use a user_id that won't appear in normal events to simulate a new/rogue actor
    rogue_user = max(user_ids) + 9999
    base = now - timedelta(days=random.randint(2, 6))
    base = base.replace(hour=random.randint(9, 17), minute=0, second=0)
    for i in range(per_pattern):
        ts = base + timedelta(minutes=i * 5)
        events.append({
            'organization_id': org_id,
            'user_id':         rogue_user,
            'action':          'document_uploaded',
            'target_type':     'Document',
            'target_id':       random.randint(51, 100),
            'meta_data':       {
                'synthetic':    True,
                'anomaly_type': 'impossible_sequence',
            },
            'created_at': ts,
        })

    # --- Pattern 4: Weekend privilege escalation ---
    # Find the most recent Saturday
    days_until_sat = (now.weekday() - 5) % 7
    base = now - timedelta(days=days_until_sat + 1)
    base = base.replace(hour=23, minute=0, second=0)
    user = random.choice(user_ids)
    for i in range(per_pattern):
        ts = base + timedelta(minutes=i * 10)
        events.append({
            'organization_id': org_id,
            'user_id':         user,
            'action':          'document_uploaded',
            'target_type':     'Document',
            'target_id':       random.randint(1, 50),
            'meta_data':       {
                'synthetic':    True,
                'anomaly_type': 'weekend_privilege',
            },
            'created_at': ts,
        })

    return events


# ---------------------------------------------------------------------------
# DB insertion
# ---------------------------------------------------------------------------

def insert_events(events: list[dict]) -> int:
    """
    Insert a list of event dicts as real AuditLog rows.
    Returns the number of rows actually inserted.
    """
    from backend.database.db import db
    from backend.database.models import AuditLog

    inserted = 0
    for ev in events:
        try:
            row = AuditLog(
                organization_id=ev['organization_id'],
                user_id=ev.get('user_id'),
                action=ev['action'],
                target_type=ev.get('target_type'),
                target_id=ev.get('target_id'),
                meta_data=ev.get('meta_data'),
                created_at=ev['created_at'],
            )
            db.session.add(row)
            inserted += 1
        except Exception as exc:
            print(f"Warning: failed to build event row: {exc}")

    try:
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        raise RuntimeError(f"Failed to commit synthetic events: {exc}") from exc

    return inserted


# ---------------------------------------------------------------------------
# High-level helper (used by API endpoint)
# ---------------------------------------------------------------------------

def generate_and_insert(org_id: int, user_ids: list[int],
                         n_normal: int = 150, n_anomalous: int = 20) -> dict:
    """Generate and insert both normal and anomalous events. Returns summary dict."""
    normal    = generate_normal_events(org_id, user_ids, n=n_normal)
    anomalous = generate_anomalous_events(org_id, user_ids, n=n_anomalous)
    all_events = normal + anomalous
    random.shuffle(all_events)   # mix order so DB insertion is realistic

    inserted = insert_events(all_events)
    return {
        'inserted':  inserted,
        'normal':    len(normal),
        'anomalous': len(anomalous),
    }


# ---------------------------------------------------------------------------
# CLI entrypoint
# ---------------------------------------------------------------------------

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Generate synthetic audit logs')
    parser.add_argument('--org-id',      type=int, default=1,   help='Organization ID')
    parser.add_argument('--n-normal',    type=int, default=150, help='Number of normal events')
    parser.add_argument('--n-anomalous', type=int, default=20,  help='Number of anomalous events')
    args = parser.parse_args()

    # Bootstrap Flask app context
    import sys, os
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
    from backend.app import create_app
    app = create_app()

    with app.app_context():
        from backend.database.models import User
        users = User.query.filter_by(organization_id=args.org_id).all()
        if not users:
            print(f"No users found for org_id={args.org_id}. Using placeholder user_ids [1, 2, 3].")
            user_ids = [1, 2, 3]
        else:
            user_ids = [u.user_id for u in users]

        result = generate_and_insert(args.org_id, user_ids,
                                      n_normal=args.n_normal,
                                      n_anomalous=args.n_anomalous)
        print(f"Inserted {result['inserted']} events "
              f"({result['normal']} normal, {result['anomalous']} anomalous)")
