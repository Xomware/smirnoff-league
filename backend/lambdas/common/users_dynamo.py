"""smirnoff-users: one profile per Cognito sub."""

from __future__ import annotations

from datetime import datetime, timezone

from lambdas.common.dynamo import from_dynamo, table

PROFILE_FIELDS = ("name", "username", "rosterId", "createdAt", "updatedAt")


def _profile(item: dict) -> dict:
    return {k: from_dynamo(item.get(k)) for k in PROFILE_FIELDS}


def get_profile(sub: str) -> dict | None:
    item = table("USERS_TABLE").get_item(Key={"sub": sub}).get("Item")
    return _profile(item) if item else None


def save_profile(sub: str, name: str, username: str, roster_id: int) -> dict:
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    item = table("USERS_TABLE").update_item(
        Key={"sub": sub},
        UpdateExpression=(
            "SET #name = :name, username = :username, rosterId = :rosterId, "
            "updatedAt = :now, createdAt = if_not_exists(createdAt, :now)"
        ),
        # `name` is a DynamoDB reserved word.
        ExpressionAttributeNames={"#name": "name"},
        ExpressionAttributeValues={
            ":name": name,
            ":username": username,
            ":rosterId": roster_id,
            ":now": now,
        },
        ReturnValues="ALL_NEW",
    )["Attributes"]
    return _profile(item)
