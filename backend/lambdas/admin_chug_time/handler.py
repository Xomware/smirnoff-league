"""
POST /admin/chug-time - set any ice's chug time and, optionally, who chugged it. Admins only.

Body: {
    "iceId": str,
    "seconds": number, 0 < seconds < 600, rounded to 0.1,
    "chugger": { "sub": str } | { "name": str <= 40 } (optional; omitted keeps the one on record),
    "note": str (optional)
}
"""

from __future__ import annotations

from lambdas.common import ice_admin
from lambdas.common.admins import require_admin
from lambdas.common.api import api_handler, body, caller_sub, ok, text


@api_handler("admin_chug_time")
def handler(event, context):
    email = require_admin(event)
    data = body(event)
    ice_id = text(data, "iceId")
    seconds = ice_admin.chug_seconds(data.get("seconds"))
    picked = data.get("chugger")
    chugger = None if picked is None else ice_admin.chugger(picked)
    note = text(data, "note", required=False)
    return ok(ice_admin.set_chug(ice_id, seconds, chugger, caller_sub(event), email, note))
