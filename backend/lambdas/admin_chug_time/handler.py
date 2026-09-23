"""
POST /admin/chug-time - set an ice's chugSeconds. Admins only.

Body: { "iceId": str, "seconds": number, 0 < seconds < 600, "note": str (optional) }
"""

from __future__ import annotations

from lambdas.common import ice_admin
from lambdas.common.admins import require_admin
from lambdas.common.api import ValidationError, api_handler, body, ok, text

MAX_SECONDS = 600


@api_handler("admin_chug_time")
def handler(event, context):
    email = require_admin(event)
    data = body(event)
    ice_id = text(data, "iceId")

    seconds = data.get("seconds")
    if type(seconds) not in (int, float) or not 0 < seconds < MAX_SECONDS:
        raise ValidationError(
            f"seconds must be a number above 0 and under {MAX_SECONDS}", field="seconds"
        )

    note = text(data, "note", required=False)
    return ok(ice_admin.set_chug(ice_id, seconds, email, note))
