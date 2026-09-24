"""
smirnoff-video-social: reactions and comments on chug videos.

Partition `VIDEO#<mediaId>` holds `REACT#<sub>` (a `types` string set, so a
toggle is one conditional ADD or DELETE) and `COMMENT#<iso time>#<id>`.
Partition `RATE#<sub>` holds one comment counter per UTC minute, expired by TTL.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

from lambdas.common import media_dynamo as media
from lambdas.common.api import ApiError, ForbiddenError, NotFoundError
from lambdas.common.dynamo import from_dynamo, query_all, table
from lambdas.common.users_dynamo import get_profile

REACTIONS = ("glacier", "stopwatch", "bottle", "siren", "crown")
COMMENTS_PER_MINUTE = 10


def ready_video(media_id: str) -> dict:
    video = media.get_video(media_id)
    if video is None or video["status"] != "ready":
        raise NotFoundError("Video not found")
    return video


def member(sub: str) -> dict:
    """The caller's profile. Reacting and commenting need a roster to attribute them to."""
    profile = get_profile(sub)
    if not profile or profile.get("rosterId") is None:
        raise ForbiddenError("Finish onboarding before reacting or commenting")
    return profile


def _conditional(**kwargs) -> bool:
    try:
        table("SOCIAL_TABLE").update_item(**kwargs)
    except ClientError as e:
        if e.response["Error"]["Code"] != "ConditionalCheckFailedException":
            raise
        return False
    return True


def toggle_reaction(media_id: str, sub: str, kind: str) -> None:
    key = {"pk": f"VIDEO#{media_id}", "sk": f"REACT#{sub}"}
    names = {"#types": "types"}
    added = _conditional(
        Key=key,
        UpdateExpression="ADD #types :set",
        ConditionExpression="attribute_not_exists(#types) OR NOT contains(#types, :kind)",
        ExpressionAttributeNames=names,
        ExpressionAttributeValues={":set": {kind}, ":kind": kind},
    )
    if not added:
        table("SOCIAL_TABLE").update_item(
            Key=key,
            UpdateExpression="DELETE #types :set",
            ExpressionAttributeNames=names,
            ExpressionAttributeValues={":set": {kind}},
        )


def take_comment_slot(sub: str) -> None:
    now = datetime.now(timezone.utc)
    taken = _conditional(
        Key={"pk": f"RATE#{sub}", "sk": now.strftime("%Y-%m-%dT%H:%M")},
        UpdateExpression="ADD #n :one SET expiresAt = :expires",
        ConditionExpression="attribute_not_exists(#n) OR #n < :max",
        ExpressionAttributeNames={"#n": "count"},
        ExpressionAttributeValues={
            ":one": 1,
            ":max": COMMENTS_PER_MINUTE,
            ":expires": int((now + timedelta(hours=1)).timestamp()),
        },
    )
    if not taken:
        raise ApiError(f"Slow down: at most {COMMENTS_PER_MINUTE} comments a minute", status=429)


def add_comment(media_id: str, sub: str, text: str) -> None:
    # Microseconds so two quick comments still sort in the order they were sent.
    now = datetime.now(timezone.utc).isoformat(timespec="microseconds")
    comment_id = uuid.uuid4().hex[:12]
    table("SOCIAL_TABLE").put_item(
        Item={
            "pk": f"VIDEO#{media_id}",
            "sk": f"COMMENT#{now}#{comment_id}",
            "commentId": comment_id,
            "sub": sub,
            "text": text,
            "createdAt": now,
        }
    )


def delete_comment(comment: dict) -> None:
    table("SOCIAL_TABLE").delete_item(Key={"pk": comment["pk"], "sk": comment["sk"]})


def _rows(media_id: str, prefix: str) -> list[dict]:
    key = Key("pk").eq(f"VIDEO#{media_id}") & Key("sk").begins_with(prefix)
    return [from_dynamo(i) for i in query_all(table("SOCIAL_TABLE"), KeyConditionExpression=key)]


def comments(media_id: str) -> list[dict]:
    """Oldest first, the sort key's order."""
    return _rows(media_id, "COMMENT#")


def author(sub: str, profiles: dict[str, dict]) -> dict:
    """Roster and display name only: a profile also holds the member's email."""
    if sub not in profiles:
        profiles[sub] = get_profile(sub) or {}
    return {"rosterId": profiles[sub].get("rosterId"), "displayName": profiles[sub].get("name")}


def payload(media_id: str, caller: str) -> dict:
    profiles: dict[str, dict] = {}
    reactions = {t: {"count": 0, "mine": False, "by": []} for t in REACTIONS}
    for row in _rows(media_id, "REACT#"):
        sub = row["sk"].removeprefix("REACT#")
        for kind in sorted(row.get("types", ())):
            r = reactions[kind]
            r["count"] += 1
            r["mine"] = r["mine"] or sub == caller
            r["by"].append(author(sub, profiles)["displayName"])
    return {
        "reactions": reactions,
        "comments": [
            {
                "id": c["commentId"],
                "author": author(c["sub"], profiles),
                "text": c["text"],
                "createdAt": c["createdAt"],
                "mine": c["sub"] == caller,
            }
            for c in comments(media_id)
        ],
    }
