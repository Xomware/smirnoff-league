"""
smirnoff-activity: what each signed-in user did, for the admin Users panel.

Keyed by sub, with the SK `<UTC ISO time>#<random>`, so one user's timeline is
a single newest-first Query. The suffix keeps two events in the same
millisecond from overwriting each other. Rows expire after RETENTION_DAYS.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from lambdas.common.dynamo import table

RETENTION_DAYS = 90


def put_events(sub: str, email: str, ua: str, events: list[dict]) -> None:
    """`events` are already validated, each `at` a timezone-aware datetime."""
    expires = int((datetime.now(timezone.utc) + timedelta(days=RETENTION_DAYS)).timestamp())
    with table("ACTIVITY_TABLE").batch_writer() as batch:
        for e in events:
            at = e["at"].astimezone(timezone.utc).isoformat(timespec="milliseconds")
            batch.put_item(
                Item={
                    "sub": sub,
                    "at": f"{at}#{uuid.uuid4().hex[:8]}",
                    "kind": e["kind"],
                    "target": e["target"],
                    "email": email,
                    "ua": ua,
                    "expiresAt": expires,
                }
            )


def recent(sub: str, limit: int) -> list[dict]:
    items = table("ACTIVITY_TABLE").query(
        KeyConditionExpression="#sub = :sub",
        ExpressionAttributeNames={"#sub": "sub"},
        ExpressionAttributeValues={":sub": sub},
        ScanIndexForward=False,
        Limit=limit,
    )["Items"]
    return [
        {"at": i["at"].split("#")[0], "kind": i["kind"], "target": i["target"], "ua": i["ua"]}
        for i in items
    ]
