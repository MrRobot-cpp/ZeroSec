"""
ZeroSec Red-Team API
Endpoints for triggering and inspecting automated firewall stress tests.

All data goes to TestRun / TestRunLog — never AuditLog.

Endpoints:
    POST /api/redteam/run           — trigger a test run (admin only)
    GET  /api/redteam/runs          — list recent runs (summary)
    GET  /api/redteam/runs/<run_id> — full detail for one run
    GET  /api/redteam/metrics       — aggregated dashboard metrics
    GET  /api/redteam/generator     — show what attacks would be generated
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt

from backend.security.red_team.attack_generator import AttackGenerator
from backend.security.red_team.test_runner import (
    run_test,
    get_run_history,
    get_run_detail,
    MAX_ATTACKS_PER_RUN,
)

red_team_bp = Blueprint("red_team_bp", __name__)

VALID_CATEGORIES = {"pii", "injection", "all"}
MAX_RUNS_PER_DAY = 20


def _is_admin() -> bool:
    try:
        claims = get_jwt()
        roles = [r.lower().replace(" ", "_") for r in claims.get("roles", [])]
        return any(r in ("admin", "super_admin", "security_admin") for r in roles)
    except Exception:
        return False


# ---------------------------------------------------------------------------
# POST /api/redteam/run
# ---------------------------------------------------------------------------
@red_team_bp.route("/api/redteam/run", methods=["POST"])
@jwt_required()
def trigger_run():
    """
    Trigger a red-team test run.
    Body (JSON, all optional):
        category    — 'pii' | 'injection' | 'all'  (default: 'all')
        notes       — free text annotation
    """
    if not _is_admin():
        return jsonify({"error": "Admin access required"}), 403

    data     = request.get_json(silent=True) or {}
    category = data.get("category", "all").lower()
    notes    = data.get("notes")
    use_llm  = bool(data.get("use_llm", False))

    if category not in VALID_CATEGORIES:
        return jsonify({
            "error": f"Invalid category '{category}'. Choose from: {sorted(VALID_CATEGORIES)}"
        }), 400

    # Enforce daily run cap
    from datetime import datetime, timezone, timedelta
    from backend.database.models import TestRun
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    runs_today  = TestRun.query.filter(TestRun.started_at >= today_start).count()

    if runs_today >= MAX_RUNS_PER_DAY:
        return jsonify({
            "error": f"Daily run cap ({MAX_RUNS_PER_DAY}) reached. Try again tomorrow.",
            "runs_today": runs_today,
        }), 429

    try:
        # Track who triggered the run
        from flask_jwt_extended import get_jwt_identity
        from backend.database.models import User
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        actor = user.username if user else f"user:{user_id}"

        result = run_test(
            category     = category,
            triggered_by = actor,
            notes        = notes,
            use_llm      = use_llm,
        )
        return jsonify(result), 200
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


# ---------------------------------------------------------------------------
# GET /api/redteam/runs
# ---------------------------------------------------------------------------
@red_team_bp.route("/api/redteam/runs", methods=["GET"])
@jwt_required()
def list_runs():
    """Return recent test run summaries."""
    if not _is_admin():
        return jsonify({"error": "Admin access required"}), 403

    limit = request.args.get("limit", 20, type=int)
    limit = min(limit, 100)

    try:
        runs = get_run_history(limit=limit)
        return jsonify({"runs": runs, "count": len(runs)}), 200
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


# ---------------------------------------------------------------------------
# GET /api/redteam/runs/<run_id>
# ---------------------------------------------------------------------------
@red_team_bp.route("/api/redteam/runs/<int:run_id>", methods=["GET"])
@jwt_required()
def get_run(run_id: int):
    """Return full detail for a single test run."""
    if not _is_admin():
        return jsonify({"error": "Admin access required"}), 403

    try:
        detail = get_run_detail(run_id)
        if detail is None:
            return jsonify({"error": f"Run {run_id} not found"}), 404
        return jsonify(detail), 200
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


# ---------------------------------------------------------------------------
# GET /api/redteam/metrics
# ---------------------------------------------------------------------------
@red_team_bp.route("/api/redteam/metrics", methods=["GET"])
@jwt_required()
def get_metrics():
    """
    Aggregated metrics for the dashboard:
    - Average accuracy over the last N runs
    - Best/worst performing difficulty level
    - Most common failure type
    - Trend (improving / degrading / stable)
    """
    if not _is_admin():
        return jsonify({"error": "Admin access required"}), 403

    from backend.database.models import TestRun, TestRunLog

    limit = request.args.get("runs", 10, type=int)
    recent_runs = (
        TestRun.query
        .order_by(TestRun.started_at.desc())
        .limit(limit)
        .all()
    )

    if not recent_runs:
        return jsonify({"message": "No test runs yet. Trigger one via POST /api/redteam/run"}), 200

    # Accuracy trend
    accuracies = [r.accuracy for r in recent_runs if r.accuracy is not None]
    avg_accuracy = sum(accuracies) / len(accuracies) if accuracies else 0

    # Trend: compare first half vs second half
    trend = "stable"
    if len(accuracies) >= 4:
        half    = len(accuracies) // 2
        recent  = sum(accuracies[:half])  / half
        older   = sum(accuracies[half:]) / half
        if recent > older + 0.02:
            trend = "improving"
        elif recent < older - 0.02:
            trend = "degrading"

    # Failure breakdown from most recent run
    latest = recent_runs[0]
    latest_failures = (
        TestRunLog.query
        .filter_by(test_run_id=latest.test_run_id, passed=False)
        .all()
    )

    failure_by_difficulty: dict[int, int] = {}
    failure_by_type: dict[str, int] = {}
    for f in latest_failures:
        failure_by_difficulty[f.difficulty] = failure_by_difficulty.get(f.difficulty, 0) + 1
        failure_by_type[f.attack_type]      = failure_by_type.get(f.attack_type, 0) + 1

    diff_labels = {1: "obvious", 2: "obfuscated", 3: "adversarial", 4: "semantic"}

    return jsonify({
        "summary": {
            "runs_analysed":  len(recent_runs),
            "avg_accuracy":   f"{avg_accuracy:.1%}",
            "trend":          trend,
            "latest_run_id":  latest.test_run_id,
            "latest_accuracy": f"{latest.accuracy:.1%}" if latest.accuracy is not None else "—",
        },
        "latest_failures": {
            "by_difficulty": {
                diff_labels.get(d, str(d)): count
                for d, count in sorted(failure_by_difficulty.items())
            },
            "by_type": failure_by_type,
        },
        "run_history": [
            {
                "run_id":    r.test_run_id,
                "accuracy":  f"{r.accuracy:.1%}" if r.accuracy is not None else "—",
                "total":     r.total_attacks,
                "failed":    r.failed,
                "started_at": r.started_at.isoformat() if r.started_at else None,
            }
            for r in recent_runs
        ],
    }), 200


# ---------------------------------------------------------------------------
# GET /api/redteam/generator
# ---------------------------------------------------------------------------
@red_team_bp.route("/api/redteam/generator", methods=["GET"])
@jwt_required()
def generator_preview():
    """
    Preview what the attack generator would produce (counts only, no vectors).
    Useful for verifying generator version and attack distribution.
    """
    if not _is_admin():
        return jsonify({"error": "Admin access required"}), 403

    gen = AttackGenerator()
    return jsonify({
        "generator_version": gen.VERSION,
        "max_per_run":       MAX_ATTACKS_PER_RUN,
        "summary":           gen.summary(),
    }), 200
