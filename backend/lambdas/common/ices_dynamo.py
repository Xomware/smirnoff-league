"""smirnoff-ices and the WEEK#ww rows of smirnoff-settings."""

from __future__ import annotations

from boto3.dynamodb.conditions import Attr, Key
from botocore.exceptions import ClientError

from lambdas.common.dynamo import from_dynamo, query_all, table, to_dynamo

SEASON = "2026"
COMPUTED_REASONS = ("zero", "empty", "lowest")


def _week_key(week: int) -> str:
    return f"WEEK#{week:02d}"


def get_week(week: int) -> dict:
    item = (
        table("SETTINGS_TABLE").get_item(Key={"season": SEASON, "key": _week_key(week)}).get("Item")
    )
    return from_dynamo(item or {})


def week_rows() -> dict[int, dict]:
    items = query_all(
        table("SETTINGS_TABLE"),
        KeyConditionExpression=Key("season").eq(SEASON) & Key("key").begins_with("WEEK#"),
    )
    return {int(i["key"][5:]): from_dynamo(i) for i in items}


def finalized_weeks() -> set[int]:
    return {w for w, row in week_rows().items() if row.get("finalizedAt")}


def set_deadline(week: int, deadline: str) -> None:
    table("SETTINGS_TABLE").update_item(
        Key={"season": SEASON, "key": _week_key(week)},
        UpdateExpression="SET deadlineUtc = :d",
        ExpressionAttributeValues={":d": deadline},
    )


def mark_finalized(week: int, now: str, overwrite: bool) -> None:
    value = ":now" if overwrite else "if_not_exists(finalizedAt, :now)"
    table("SETTINGS_TABLE").update_item(
        Key={"season": SEASON, "key": _week_key(week)},
        UpdateExpression=f"SET finalizedAt = {value}",
        ExpressionAttributeValues={":now": now},
    )


def put_ice(ice: dict, now: str, source: str = "cron") -> bool:
    """Writes an owed ice unless its id already exists. False means it did."""
    fields = {k: v for k, v in ice.items() if k != "id"}
    item = {
        "season": SEASON,
        "iceId": ice["id"],
        **fields,
        "status": "owed",
        "source": source,
        "createdAt": now,
    }
    try:
        table("ICES_TABLE").put_item(
            Item=to_dynamo(item), ConditionExpression="attribute_not_exists(iceId)"
        )
    except ClientError as e:
        if e.response["Error"]["Code"] != "ConditionalCheckFailedException":
            raise
        return False
    return True


def computed_rows(week: int) -> dict[str, dict]:
    """The week's cron-computed ices by id. Admin and late rows are never included."""
    items = query_all(
        table("ICES_TABLE"),
        KeyConditionExpression=Key("season").eq(SEASON) & Key("iceId").begins_with(f"W{week:02d}#"),
        FilterExpression=Attr("source").eq("cron") & Attr("reason").is_in(list(COMPUTED_REASONS)),
    )
    return {i["iceId"]: from_dynamo(i) for i in items}


def get_ice(ice_id: str) -> dict | None:
    item = table("ICES_TABLE").get_item(Key={"season": SEASON, "iceId": ice_id}).get("Item")
    return from_dynamo(item) if item else None


def season_ices() -> list[dict]:
    items = query_all(table("ICES_TABLE"), KeyConditionExpression=Key("season").eq(SEASON))
    return [from_dynamo(i) for i in items]


def update_ice(ice_id: str, fields: dict) -> None:
    names = {f"#f{n}": k for n, k in enumerate(fields)}
    table("ICES_TABLE").update_item(
        Key={"season": SEASON, "iceId": ice_id},
        UpdateExpression="SET " + ", ".join(f"{n} = :{n[1:]}" for n in names),
        ExpressionAttributeNames=names,
        ExpressionAttributeValues={
            f":{n[1:]}": to_dynamo(v) for n, v in zip(names, fields.values())
        },
    )
