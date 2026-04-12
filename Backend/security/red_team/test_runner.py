"""
ZeroSec Red-Team Test Runner

Runs generated attacks through the firewall and logs results to TestRun/TestRunLog.
NEVER writes to AuditLog — completely isolated from production.

Safety caps:
    MAX_ATTACKS_PER_RUN = 100
    MAX_RUNS_PER_DAY    = 5  (enforced by API layer)
"""

from __future__ import annotations

import uuid
import logging
from datetime import datetime, timezone
from typing import Optional

from backend.security.red_team.attack_generator import AttackGenerator, Attack

_log = logging.getLogger("zerosec.redteam")

MAX_ATTACKS_PER_RUN = 200


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _run_single(attack: Attack) -> dict:
    """
    Pass one attack through the firewall and return the result dict.
    Catches all exceptions — a crash is treated as a miss (firewall failed).
    """
    from backend.security import firewall

    try:
        result = firewall.inspect_text(attack.text)
        decision = result.get("decision", "ALLOW")
        score    = float(result.get("score", 0.0))
        reason   = result.get("reason", "")
        patterns = result.get("patterns", [])
        sanitized = result.get("sanitized", "")

        layer_breakdown = {
            "regex_hit":  bool(patterns),
            "ml_score":   score,
            "reason":     reason,
        }
    except Exception as exc:
        _log.error("[redteam] firewall error on attack '%s': %s", attack.text[:60], exc)
        decision        = "ALLOW"   # treat crash as miss
        score           = 0.0
        patterns        = []
        sanitized       = ""
        layer_breakdown = {"error": str(exc)}

    # PII attacks: the firewall redacts rather than blocks.
    # Pass = BLOCK/FLAG *or* PII was detected and redacted from the output.
    if attack.attack_type == "pii_obfuscation":
        expected = "REDACT"
        pii_redacted = bool(patterns) or ("<REDACTED>" in sanitized)
        passed = decision in ("BLOCK", "FLAG") or pii_redacted
    else:
        expected = "BLOCK"
        passed = decision in ("BLOCK", "FLAG")

    return {
        "attack_type":       attack.attack_type,
        "difficulty":        attack.difficulty,
        "attack_vector":     attack.text,
        "firewall_decision": decision,
        "expected_decision": expected,
        "passed":            passed,
        "score":             score,
        "layer_breakdown":   layer_breakdown,
    }


def _get_missed_attacks(category: str, limit: int = 40) -> list[Attack]:
    """
    Pull failed attack vectors from the most recent run of the same category.
    These are replayed first so we can track whether gaps get fixed over time.
    """
    from backend.database.models import TestRun, TestRunLog

    last_run = (
        TestRun.query
        .filter_by(attack_category=category)
        .order_by(TestRun.started_at.desc())
        .first()
    )
    if not last_run:
        # Also try 'all' category if exact category has no prior run
        last_run = (
            TestRun.query
            .order_by(TestRun.started_at.desc())
            .first()
        )
    if not last_run:
        return []

    missed_logs = (
        TestRunLog.query
        .filter_by(test_run_id=last_run.test_run_id, passed=False)
        .order_by(TestRunLog.difficulty.desc())   # hardest first
        .limit(limit)
        .all()
    )

    attacks = []
    for log in missed_logs:
        attacks.append(Attack(
            text=log.attack_vector,
            attack_type=log.attack_type,
            difficulty=log.difficulty,
            seed=f"replay:run#{last_run.test_run_id}",
        ))

    if attacks:
        _log.info(
            "[redteam] Replaying %d missed attacks from run #%d",
            len(attacks), last_run.test_run_id,
        )
    return attacks


def run_test(
    category: str = "all",
    triggered_by: str = "manual",
    notes: Optional[str] = None,
    use_llm: bool = False,
) -> dict:
    """
    Execute a complete red-team test run.

    Args:
        category:     'pii' | 'injection' | 'all'
        triggered_by: 'manual' | 'scheduler'
        notes:        Optional free-text annotation
        use_llm:      Include LLM-generated novel attacks (requires GROQ_API_KEY)

    Returns:
        Summary dict with run_id, accuracy, counts, failures list.
    """
    from backend.database.db import db
    from backend.database.models import TestRun, TestRunLog

    generator = AttackGenerator()

    # Build attack pool: missed replays first, then static, then LLM
    # Missed attacks get priority so every run re-validates known gaps
    missed_attacks  = _get_missed_attacks(category, limit=40)
    missed_texts    = {a.text for a in missed_attacks}

    static_attacks  = generator.generate_by_category(category, use_llm=False)
    # Deduplicate static against replayed misses (same text already covered)
    static_attacks  = [a for a in static_attacks if a.text not in missed_texts]

    llm_attacks: list[Attack] = []
    if use_llm:
        llm_attacks = generator._generate_llm_attacks(category)

    # Final pool: missed → static → LLM, then cap
    attacks = (missed_attacks + static_attacks + llm_attacks)[:MAX_ATTACKS_PER_RUN]

    run_uuid   = str(uuid.uuid4())
    started_at = _utcnow()

    _log.info(
        "[redteam] Starting run %s | category=%s | attacks=%d (replay=%d static=%d llm=%d) | by=%s",
        run_uuid, category, len(attacks),
        len(missed_attacks), len(static_attacks), len(llm_attacks),
        triggered_by,
    )

    # Create the run record first so FK is valid
    run = TestRun(
        run_uuid          = run_uuid,
        attack_category   = category,
        generator_version = generator.VERSION,
        total_attacks     = len(attacks),
        triggered_by      = triggered_by,
        started_at        = started_at,
        notes             = notes,
    )
    db.session.add(run)
    db.session.flush()   # get run.test_run_id without committing

    passed_count  = 0
    failed_count  = 0
    failures      = []

    for attack in attacks:
        result = _run_single(attack)

        log_entry = TestRunLog(
            test_run_id       = run.test_run_id,
            attack_type       = result["attack_type"],
            difficulty        = result["difficulty"],
            attack_vector     = result["attack_vector"],
            firewall_decision = result["firewall_decision"],
            expected_decision = result["expected_decision"],
            passed            = result["passed"],
            score             = result["score"],
            layer_breakdown   = result["layer_breakdown"],
        )
        db.session.add(log_entry)

        if result["passed"]:
            passed_count += 1
        else:
            failed_count += 1
            failures.append({
                "attack_type": result["attack_type"],
                "difficulty":  result["difficulty"],
                "vector":      result["attack_vector"][:120],
                "decision":    result["firewall_decision"],
                "score":       result["score"],
            })

    accuracy = passed_count / len(attacks) if attacks else 0.0

    run.passed     = passed_count
    run.failed     = failed_count
    run.accuracy   = accuracy
    run.ended_at   = _utcnow()

    db.session.commit()

    _log.info(
        "[redteam] Run %s complete | passed=%d failed=%d accuracy=%.1f%%",
        run_uuid, passed_count, failed_count, accuracy * 100,
    )

    # Layer-level breakdown
    layer_stats = _compute_layer_stats(attacks, run.test_run_id)

    return {
        "run_id":        run.test_run_id,
        "run_uuid":      run_uuid,
        "category":      category,
        "total":         len(attacks),
        "passed":        passed_count,
        "failed":        failed_count,
        "accuracy":      round(accuracy, 4),
        "accuracy_pct":  f"{accuracy:.1%}",
        "failures":      failures,
        "layer_stats":   layer_stats,
        "started_at":    started_at.isoformat(),
        "ended_at":      run.ended_at.isoformat(),
        "replay_count":  len(missed_attacks),
        "llm_count":     len(llm_attacks),
    }


def _compute_layer_stats(attacks: list[Attack], test_run_id: int) -> dict:
    """
    Pull TestRunLog for this run and compute per-difficulty and per-type stats.
    """
    from backend.database.models import TestRunLog

    logs = TestRunLog.query.filter_by(test_run_id=test_run_id).all()
    if not logs:
        return {}

    by_difficulty: dict[int, dict] = {}
    by_type: dict[str, dict] = {}

    for entry in logs:
        # By difficulty
        d = entry.difficulty
        if d not in by_difficulty:
            by_difficulty[d] = {"total": 0, "passed": 0}
        by_difficulty[d]["total"]  += 1
        by_difficulty[d]["passed"] += int(entry.passed)

        # By attack type
        t = entry.attack_type
        if t not in by_type:
            by_type[t] = {"total": 0, "passed": 0}
        by_type[t]["total"]  += 1
        by_type[t]["passed"] += int(entry.passed)

    # Convert to accuracy percentages
    diff_labels = {1: "obvious", 2: "obfuscated", 3: "adversarial", 4: "semantic"}

    difficulty_stats = {}
    for d, counts in sorted(by_difficulty.items()):
        acc = counts["passed"] / counts["total"] if counts["total"] else 0
        difficulty_stats[diff_labels.get(d, str(d))] = {
            "total":    counts["total"],
            "passed":   counts["passed"],
            "accuracy": f"{acc:.1%}",
        }

    type_stats = {}
    for t, counts in by_type.items():
        acc = counts["passed"] / counts["total"] if counts["total"] else 0
        type_stats[t] = {
            "total":    counts["total"],
            "passed":   counts["passed"],
            "accuracy": f"{acc:.1%}",
        }

    return {
        "by_difficulty": difficulty_stats,
        "by_type":       type_stats,
    }


def get_run_history(limit: int = 20) -> list[dict]:
    """Return recent test run summaries (no attack vectors — summary only)."""
    from backend.database.models import TestRun

    runs = (
        TestRun.query
        .order_by(TestRun.started_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "run_id":    r.test_run_id,
            "run_uuid":  r.run_uuid,
            "category":  r.attack_category,
            "total":     r.total_attacks,
            "passed":    r.passed,
            "failed":    r.failed,
            "accuracy":  f"{r.accuracy:.1%}" if r.accuracy is not None else "—",
            "triggered_by": r.triggered_by,
            "started_at":   r.started_at.isoformat() if r.started_at else None,
        }
        for r in runs
    ]


def get_run_detail(run_id: int) -> Optional[dict]:
    """Return full detail for a single test run including all attack results."""
    from backend.database.models import TestRun, TestRunLog

    run = TestRun.query.get(run_id)
    if not run:
        return None

    logs = (
        TestRunLog.query
        .filter_by(test_run_id=run_id)
        .order_by(TestRunLog.difficulty, TestRunLog.timestamp)
        .all()
    )

    return {
        "run_id":    run.test_run_id,
        "run_uuid":  run.run_uuid,
        "category":  run.attack_category,
        "total":     run.total_attacks,
        "passed":    run.passed,
        "failed":    run.failed,
        "accuracy":  f"{run.accuracy:.1%}" if run.accuracy is not None else "—",
        "triggered_by": run.triggered_by,
        "generator_version": run.generator_version,
        "started_at": run.started_at.isoformat() if run.started_at else None,
        "ended_at":   run.ended_at.isoformat()   if run.ended_at   else None,
        "notes":      run.notes,
        "layer_stats": _compute_layer_stats([], run_id),
        "attacks": [
            {
                "log_id":    e.log_id,
                "type":      e.attack_type,
                "difficulty": e.difficulty,
                "vector":    e.attack_vector,
                "decision":  e.firewall_decision,
                "expected":  e.expected_decision,
                "passed":    e.passed,
                "score":     e.score,
                "breakdown": e.layer_breakdown,
            }
            for e in logs
        ],
    }
