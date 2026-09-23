"""GET /ledger/get - the season's non-voided ices, week settings, toilet byes and a per-roster summary."""

from __future__ import annotations

from datetime import datetime, timezone

from lambdas.common import ices_dynamo as db
from lambdas.common.api import api_handler, caller_sub, ok
from lambdas.common.dynamo import from_dynamo, table
from lambdas.common.ices import default_week_settings

DEFAULT_TOILET_BYES = [13, 14]


def summarize(ices: list[dict], deadlines: dict[int, datetime], now: datetime) -> list[dict]:
    """owed/completed/overdue count original ices; late/lateOwed count the late rows."""
    rosters: dict[int, dict] = {}
    for ice in ices:
        s = rosters.setdefault(
            ice["rosterId"],
            {"rosterId": ice["rosterId"], "owed": 0, "completed": 0, "late": 0, "lateOwed": 0, "overdue": 0},
        )
        owed = ice["status"] == "owed"
        if ice["reason"] == "late":
            s["late"] += 1
            s["lateOwed"] += owed
            continue
        s["owed"] += owed
        s["completed"] += ice["status"] == "completed"
        deadline = deadlines.get(ice["week"])
        s["overdue"] += owed and deadline is not None and deadline < now
    return [rosters[r] for r in sorted(rosters)]


@api_handler("ledger_get")
def handler(event, context):
    caller_sub(event)
    # updatedBy is the editing admin's email, and every signed-in user reads this.
    ices = [
        {k: v for k, v in i.items() if k != "updatedBy"}
        for i in db.season_ices()
        if i["status"] != "voided"
    ]
    weeks = [
        {
            "week": week,
            "finalizedAt": row.get("finalizedAt"),
            "deadlineUtc": row.get("deadlineUtc"),
            **{k: row.get(k, v) for k, v in default_week_settings(week).items()},
        }
        for week, row in sorted(db.week_rows().items())
    ]
    toilet = table("SETTINGS_TABLE").get_item(Key={"season": db.SEASON, "key": "TOILET_BRACKET"}).get("Item")
    deadlines = {w["week"]: datetime.fromisoformat(w["deadlineUtc"]) for w in weeks if w["deadlineUtc"]}
    summary = summarize(ices, deadlines, datetime.now(timezone.utc))
    byes = from_dynamo(toilet)["byes"] if toilet else DEFAULT_TOILET_BYES
    return ok({"ices": ices, "weeks": weeks, "summary": summary, "toiletByes": byes})
