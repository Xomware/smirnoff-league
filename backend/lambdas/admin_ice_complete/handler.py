"""
POST /admin/ice-complete - mark an ice completed, or undo that. Admins only.

Body: { "iceId": str, "completed": bool, "at": ISO time with offset (optional,
default now, may be backdated), "note": str (optional) }

Undo sets the ice back to owed and drops completedAt.
"""

from __future__ import annotations

from datetime import datetime

from lambdas.common import ice_admin
from lambdas.common.admins import require_admin
from lambdas.common.api import ValidationError, api_handler, body, ok, text


@api_handler("admin_ice_complete")
def handler(event, context):
    email = require_admin(event)
    data = body(event)
    ice_id = text(data, "iceId")

    completed = data.get("completed")
    if type(completed) is not bool:
        raise ValidationError("completed must be true or false", field="completed")

    at = data.get("at")
    if at is not None:
        if not completed:
            raise ValidationError("at only applies when completing", field="at")
        try:
            at = datetime.fromisoformat(at)
        except (TypeError, ValueError):
            raise ValidationError("at must be an ISO time with a UTC offset", field="at")

    note = text(data, "note", required=False)
    return ok(ice_admin.set_completed(ice_id, completed, at, email, note))
