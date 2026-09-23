"""
POST /admin/settings - week ice settings or the toilet bracket byes. Admins only.

Body: { "week": 1-17, "iceRulesActive": bool?, "lowestScope": "all" | "played"?, "note": str? }
   or { "toiletByes": [two different seeds from 9 to 14], "note": str? }

Week changes apply from the next finalize; an already finalized week needs a
re-finalize to pick them up.
"""

from __future__ import annotations

from lambdas.common import ice_admin
from lambdas.common.admins import require_admin
from lambdas.common.api import ValidationError, api_handler, body, ok, text, whole
from lambdas.common.ices_dynamo import week_key

TOILET_SEEDS = range(9, 15)
SCOPES = ("all", "played")


@api_handler("admin_settings")
def handler(event, context):
    email = require_admin(event)
    data = body(event)
    note = text(data, "note", required=False)

    if "toiletByes" in data:
        if "week" in data:
            raise ValidationError("send week settings or toiletByes, not both", field="toiletByes")
        byes = data["toiletByes"]
        if (
            not isinstance(byes, list)
            or len(byes) != 2
            or any(type(b) is not int or b not in TOILET_SEEDS for b in byes)
            or byes[0] == byes[1]
        ):
            raise ValidationError(
                "toiletByes must be two different seeds from 9 to 14", field="toiletByes"
            )
        return ok(ice_admin.set_setting("TOILET_BRACKET", {"byes": byes}, email, note))

    week = whole(data, "week", 1, 17)
    fields = {k: data[k] for k in ("iceRulesActive", "lowestScope") if k in data}
    if not fields:
        raise ValidationError("send iceRulesActive or lowestScope", field="iceRulesActive")
    if "iceRulesActive" in fields and type(fields["iceRulesActive"]) is not bool:
        raise ValidationError("iceRulesActive must be true or false", field="iceRulesActive")
    if "lowestScope" in fields and fields["lowestScope"] not in SCOPES:
        raise ValidationError('lowestScope must be "all" or "played"', field="lowestScope")
    return ok(ice_admin.set_setting(week_key(week), fields, email, note))
