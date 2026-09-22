"""
POST /admin/finalize - finalize or re-finalize one week's ices. Admins only.

Body: { "week": int 1-17, "refinalize": bool (default false) }

Unlike cron_tick this does not wait for ESPN to call the week final; the admin
is the judge of that.
"""

from __future__ import annotations

from lambdas.common.admins import require_admin
from lambdas.common.api import ValidationError, api_handler, body, ok
from lambdas.common.finalize import finalize_week


@api_handler("admin_finalize")
def handler(event, context):
    require_admin(event)
    data = body(event)

    week = data.get("week")
    # bool is an int subclass, so True would otherwise pass as week 1.
    if type(week) is not int or not 1 <= week <= 17:
        raise ValidationError("week must be a whole number from 1 to 17", field="week")

    refinalize = data.get("refinalize", False)
    if type(refinalize) is not bool:
        raise ValidationError("refinalize must be true or false", field="refinalize")

    return ok(finalize_week(week, refinalize))
