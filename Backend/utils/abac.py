"""
ABAC Evaluation Engine

Evaluates attribute-based access control policies stored in the Policy table
(policy_type='abac'). Each policy has a JSON config with this structure:

{
  "name": "High Clearance Rule",
  "enforcement_mode": "permissive",   # "permissive" (default-allow) | "strict" (default-deny)
  "rules": [
    {
      "id": "rule-1",
      "name": "Block insufficient clearance",
      "conditions": [
        { "user_attr": "clearance_level", "operator": "lt", "doc_attr": "clearance_level" }
      ],
      "logic": "AND",
      "outcome": "DENY",
      "enabled": true
    }
  ]
}

Supported user_attr / doc_attr values:
  User:     clearance_level (int), department_id (int), status (str)
  Document: clearance_level (int), sensitivity (str: Low/Medium/High)

Supported operators: eq, neq, lt, lte, gt, gte
"""

from backend.database.models import Policy


# Sensitivity strings ranked numerically for comparison operators
_SENSITIVITY_RANK = {'low': 1, 'medium': 2, 'high': 3}


def _resolve_user_attr(user, attr):
    if attr == 'clearance_level':
        return user.clearance_level.level if user and user.clearance_level else 0
    if attr == 'department_id':
        return user.department_id if user else None
    if attr == 'status':
        return (user.status or '').lower() if user else ''
    return None


def _resolve_doc_attr(document, attr):
    if attr == 'clearance_level':
        return document.clearance_level.level if document.clearance_level else 0
    if attr == 'department_id':
        return getattr(document, 'department_id', None)
    if attr == 'sensitivity':
        return _SENSITIVITY_RANK.get((document.sensitivity or '').lower(), 0)
    return None


def _compare(left, operator, right):
    if left is None or right is None:
        return False
    try:
        if operator == 'eq':  return left == right
        if operator == 'neq': return left != right
        if operator == 'lt':  return left < right
        if operator == 'lte': return left <= right
        if operator == 'gt':  return left > right
        if operator == 'gte': return left >= right
    except TypeError:
        return False
    return False


def _evaluate_rule(rule, user, document):
    """Return True if all conditions in the rule match."""
    conditions = rule.get('conditions', [])
    if not conditions:
        return False
    results = []
    for cond in conditions:
        left = _resolve_user_attr(user, cond.get('user_attr', ''))
        right = _resolve_doc_attr(document, cond.get('doc_attr', ''))
        results.append(_compare(left, cond.get('operator', 'eq'), right))
    logic = rule.get('logic', 'AND').upper()
    return all(results) if logic == 'AND' else any(results)


def evaluate_abac_policies(user, document, organization_id):
    """
    Evaluate all enabled ABAC policies for the org against (user, document).

    Returns (allowed: bool, reason: str).
    Default behaviour is permissive (allow unless a DENY rule matches).
    Strict enforcement_mode flips this: deny unless an ALLOW rule matches.
    """
    try:
        policies = Policy.query.filter_by(
            organization_id=organization_id,
            policy_type='abac',
            enabled=True,
        ).all()
    except Exception:
        return True, 'permitted (policy load error)'

    for policy in policies:
        config = policy.config or {}
        strict = config.get('enforcement_mode', 'permissive') == 'strict'
        rules = config.get('rules', [])
        matched_allow = False

        for rule in rules:
            if not rule.get('enabled', True):
                continue
            if not _evaluate_rule(rule, user, document):
                continue
            outcome = rule.get('outcome', 'DENY').upper()
            if outcome == 'DENY':
                return False, rule.get('name', 'ABAC policy denied access')
            if outcome == 'ALLOW':
                matched_allow = True

        if strict and not matched_allow:
            return False, f"No ALLOW rule matched in strict policy '{config.get('name', policy.policy_id)}'"

    return True, 'permitted'
