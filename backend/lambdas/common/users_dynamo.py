"""smirnoff-users: one profile per Cognito sub."""

from __future__ import annotations

from datetime import datetime, timezone

from botocore.exceptions import ClientError

from lambdas.common.api import NotFoundError
from lambdas.common.dynamo import from_dynamo, table

PROFILE_FIELDS = ("name", "username", "rosterId", "notificationsSeenAt", "createdAt", "updatedAt")


def _profile(item: dict) -> dict:
    return {k: from_dynamo(item.get(k)) for k in PROFILE_FIELDS}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def get_profile(sub: str) -> dict | None:
    item = table("USERS_TABLE").get_item(Key={"sub": sub}).get("Item")
    return _profile(item) if item else None


def save_profile(sub: str, name: str, username: str, roster_id: int, seen_at: str | None = None) -> dict:
    values = {":name": name, ":username": username, ":rosterId": roster_id, ":now": _now()}
    expression = (
        "SET #name = :name, username = :username, rosterId = :rosterId, "
        "updatedAt = :now, createdAt = if_not_exists(createdAt, :now)"
    )
    if seen_at is not None:
        expression += ", notificationsSeenAt = :seenAt"
        values[":seenAt"] = seen_at
    item = table("USERS_TABLE").update_item(
        Key={"sub": sub},
        UpdateExpression=expression,
        # `name` is a DynamoDB reserved word.
        ExpressionAttributeNames={"#name": "name"},
        ExpressionAttributeValues=values,
        ReturnValues="ALL_NEW",
    )["Attributes"]
    return _profile(item)


def save_seen_at(sub: str, seen_at: str) -> dict:
    """Sets only the notifications read mark, on a profile that must already exist."""
    try:
        item = table("USERS_TABLE").update_item(
            Key={"sub": sub},
            UpdateExpression="SET notificationsSeenAt = :seenAt, updatedAt = :now",
            ConditionExpression="attribute_exists(#sub)",
            ExpressionAttributeNames={"#sub": "sub"},
            ExpressionAttributeValues={":seenAt": seen_at, ":now": _now()},
            ReturnValues="ALL_NEW",
        )["Attributes"]
    except ClientError as e:
        if e.response["Error"]["Code"] != "ConditionalCheckFailedException":
            raise
        raise NotFoundError("No profile yet: finish onboarding first")
    return _profile(item)
