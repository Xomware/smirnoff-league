"""
GET /admin/activity?sub=<sub>&limit=<1-200> - one user's activity, newest first. Admins only.

limit defaults to 100.
"""

from __future__ import annotations

from lambdas.common.activity_dynamo import recent
from lambdas.common.admins import require_admin
from lambdas.common.api import ValidationError, api_handler, ok, query, require

MAX_LIMIT = 200


@api_handler("admin_activity")
def handler(event, context):
    require_admin(event)
    params = query(event)
    [sub] = require(params, "sub")
    raw = params.get("limit") or "100"
    if not raw.isdigit() or not 1 <= int(raw) <= MAX_LIMIT:
        raise ValidationError(f"limit must be a whole number from 1 to {MAX_LIMIT}", field="limit")
    return ok(recent(sub, int(raw)))
