"""
Late ices, per "Late ices" in docs/features/smirnoff-league/PLAN.md.

Each original ice unpaid at its week's deadline adds one late ice per week late.
Late ices are rows `{parentIceId}#LATE{n}` that reconcile() keeps equal to
late_count: missing ones are created, extras (an admin backdated the parent's
completion) are voided, and a completed late row is never touched.
"""

from __future__ import annotations

from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from lambdas.common import espn
from lambdas.common import ices_dynamo as db
from lambdas.common.logger import get_logger

log = get_logger(__file__)

ET = ZoneInfo("America/New_York")
SUNDAY = 6
WEEK = timedelta(days=7)


def deadline_for(last_game_utc: datetime) -> datetime:
    """The first Sunday 13:00 America/New_York strictly after the last kickoff, in UTC."""
    kickoff = last_game_utc.astimezone(ET)
    day = kickoff.date() + timedelta(days=(SUNDAY - kickoff.weekday()) % 7)
    deadline = datetime.combine(day, time(13), tzinfo=ET)
    if deadline <= kickoff:
        deadline = datetime.combine(day + WEEK, time(13), tzinfo=ET)
    return deadline.astimezone(timezone.utc)


def late_count(deadline: datetime, completed_at: datetime | None, now: datetime) -> int:
    t = completed_at or now
    if t <= deadline:
        return 0
    # Each +1 lands on a Sunday 13:00 ET, so step in wall-clock weeks: adding a
    # timedelta to an ET datetime keeps 13:00 across DST, where 7x24h would not.
    local = deadline.astimezone(ET)
    weeks = 0
    while local + (weeks + 1) * WEEK <= t:
        weeks += 1
    return 1 + weeks


def week_deadlines() -> dict[int, datetime]:
    """Deadlines of finalized weeks, fetching and storing any not yet on WEEK#ww."""
    deadlines = {}
    for week, row in db.week_rows().items():
        if not row.get("finalizedAt"):
            continue
        if row.get("deadlineUtc"):
            deadlines[week] = datetime.fromisoformat(row["deadlineUtc"])
            continue
        last = espn.last_game_utc(week)
        if last is None:
            log.warning("week %d has no ESPN games, so no deadline or late ices yet", week)
            continue
        deadlines[week] = deadline_for(last)
        db.set_deadline(week, deadlines[week].isoformat())
    return deadlines


def reconcile(now: datetime) -> dict:
    deadlines = week_deadlines()
    ices = db.season_ices()
    by_id = {i["iceId"]: i for i in ices}
    stamp = now.isoformat(timespec="seconds")
    counts = {"created": 0, "revived": 0, "voided": 0}

    for parent in ices:
        deadline = deadlines.get(parent["week"])
        # Only computed ices accrue. An admin ice is a hand adjustment, often
        # added weeks later, and would otherwise arrive already late.
        if parent["reason"] not in db.COMPUTED_REASONS or deadline is None:
            continue
        paid = parent.get("completedAt") if parent["status"] == "completed" else None
        due = 0
        if parent["status"] != "voided":
            due = late_count(deadline, paid and datetime.fromisoformat(paid), now)

        n = 1
        while n <= due or f"{parent['iceId']}#LATE{n}" in by_id:
            ice_id = f"{parent['iceId']}#LATE{n}"
            row = by_id.get(ice_id)
            if n <= due and row is None:
                late = {"id": ice_id, "week": parent["week"], "rosterId": parent["rosterId"]}
                db.put_ice({**late, "reason": "late", "parentIceId": parent["iceId"]}, stamp)
                counts["created"] += 1
            elif n <= due and row["status"] == "voided":
                db.update_ice(ice_id, {"status": "owed", "updatedAt": stamp})
                counts["revived"] += 1
            elif n > due and row["status"] == "owed":
                db.update_ice(ice_id, {"status": "voided", "updatedAt": stamp})
                counts["voided"] += 1
            n += 1

    log.info("late ices reconciled: %s", counts)
    return counts
