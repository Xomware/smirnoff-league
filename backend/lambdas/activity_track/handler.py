"""
POST /activity/track - record a batch of the caller's own app activity.

Body: { "events": [{ "kind": "signin" | "open" | "drill" | "upload" | "publish",
                     "target": str (<= 120 chars), "at": ISO time with offset }] }  (1-50)

sub and email come from the token and the device from the User-Agent header, so
a caller can only ever write their own rows. One bad event rejects the batch.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from lambdas.common.activity_dynamo import put_events
from lambdas.common.api import ValidationError, api_handler, body, caller_email, caller_sub, ok
from lambdas.common.user_agent import ua_family

KINDS = ("signin", "open", "drill", "upload", "publish")
MAX_BATCH = 50
MAX_TARGET = 120
# The client flushes every 30 seconds, or on its next visit after an offline
# spell; anything outside this window is a broken clock or a replay.
MAX_AHEAD = timedelta(minutes=10)
MAX_AGE = timedelta(hours=24)


def _event(raw, i: int, now: datetime) -> dict:
    field = f"events[{i}]"
    if not isinstance(raw, dict):
        raise ValidationError("each event must be an object", field=field)
    if raw.get("kind") not in KINDS:
        raise ValidationError(f"kind must be one of {', '.join(KINDS)}", field=f"{field}.kind")
    target = raw.get("target")
    if not isinstance(target, str) or len(target) > MAX_TARGET:
        raise ValidationError(f"target must be text up to {MAX_TARGET} characters", field=f"{field}.target")
    try:
        at = datetime.fromisoformat(raw.get("at"))
    except (TypeError, ValueError):
        at = None
    if at is None or at.tzinfo is None or not now - MAX_AGE <= at <= now + MAX_AHEAD:
        raise ValidationError(
            "at must be an ISO time with offset, within the last 24 hours", field=f"{field}.at"
        )
    return {"kind": raw["kind"], "target": target, "at": at}


@api_handler("activity_track")
def handler(event, context):
    sub = caller_sub(event)
    email = caller_email(event)
    raw = body(event).get("events")
    if not isinstance(raw, list) or not 1 <= len(raw) <= MAX_BATCH:
        raise ValidationError(f"events must be a list of 1 to {MAX_BATCH}", field="events")
    now = datetime.now(timezone.utc)
    events = [_event(e, i, now) for i, e in enumerate(raw)]
    put_events(sub, email, ua_family(event), events)
    return ok({"recorded": len(events)})
