"""smirnoff-users: one profile per Cognito sub."""

from __future__ import annotations

from datetime import datetime, timezone

from botocore.exceptions import ClientError

from lambdas.common.api import NotFoundError
from lambdas.common.dynamo import from_dynamo, table, to_dynamo
from lambdas.common.email_prefs import with_defaults

PROFILE_FIELDS = (
    "name",
    "username",
    "rosterId",
    "emailAddress",
    "notificationsSeenAt",
    "createdAt",
    "updatedAt",
)


def _profile(item: dict) -> dict:
    profile = {k: from_dynamo(item.get(k)) for k in PROFILE_FIELDS}
    profile["email"] = with_defaults(item.get("email"))
    return profile


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def get_profile(sub: str) -> dict | None:
    item = table("USERS_TABLE").get_item(Key={"sub": sub}).get("Item")
    return _profile(item) if item else None


def list_profiles() -> list[dict]:
    """Every profile with its sub. A scan, since the table holds one row per league member."""
    tbl = table("USERS_TABLE")
    page = tbl.scan()
    items = page["Items"]
    while "LastEvaluatedKey" in page:
        page = tbl.scan(ExclusiveStartKey=page["LastEvaluatedKey"])
        items += page["Items"]
    return [{"sub": i["sub"], **_profile(i)} for i in items]


def save_profile(
    sub: str, name: str, username: str, roster_id: int, address: str, seen_at: str | None = None
) -> dict:
    values = {
        ":name": name,
        ":username": username,
        ":rosterId": roster_id,
        ":address": address,
        ":now": _now(),
    }
    expression = (
        "SET #name = :name, username = :username, rosterId = :rosterId, emailAddress = :address, "
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


def update_profile(sub: str, fields: dict) -> dict:
    """Sets the given top-level fields on a profile that must already exist."""
    names = {f"#f{i}": k for i, k in enumerate(fields)}
    values = {f":v{i}": to_dynamo(v) for i, v in enumerate(fields.values())}
    sets = ", ".join(f"#f{i} = :v{i}" for i in range(len(fields)))
    try:
        item = table("USERS_TABLE").update_item(
            Key={"sub": sub},
            UpdateExpression=f"SET {sets}, updatedAt = :now",
            ConditionExpression="attribute_exists(#sub)",
            ExpressionAttributeNames={"#sub": "sub", **names},
            ExpressionAttributeValues={":now": _now(), **values},
            ReturnValues="ALL_NEW",
        )["Attributes"]
    except ClientError as e:
        if e.response["Error"]["Code"] != "ConditionalCheckFailedException":
            raise
        raise NotFoundError("No profile yet: finish onboarding first")
    return _profile(item)
