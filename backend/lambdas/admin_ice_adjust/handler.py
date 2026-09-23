"""
POST /admin/ice-adjust - add an admin ice or void any ice. Admins only.

Body: { "action": "add", "week": 1-17, "rosterId": 1-14, "note": str }
   or { "action": "void", "iceId": str, "note": str }
"""

from __future__ import annotations

from lambdas.common import ice_admin
from lambdas.common.admins import require_admin
from lambdas.common.api import ValidationError, api_handler, body, ok, text, whole


@api_handler("admin_ice_adjust")
def handler(event, context):
    email = require_admin(event)
    data = body(event)
    action = data.get("action")

    if action == "add":
        week = whole(data, "week", 1, 17)
        roster = whole(data, "rosterId", 1, 14)
        return ok(ice_admin.add(week, roster, text(data, "note"), email))
    if action == "void":
        ice_id = text(data, "iceId")
        return ok(ice_admin.void(ice_id, text(data, "note"), email))
    raise ValidationError('action must be "add" or "void"', field="action")
