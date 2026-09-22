"""
Snapshot a week's ices into smirnoff-ices. Shared by cron_tick and POST /admin/finalize.

A plain finalize only ever adds rows, so running it twice is a no-op. Re-finalize
recomputes from Sleeper as of now: computed rows the new result drops are voided,
rows it still produces keep their status (a voided one returns to owed), and
admin and late rows are never read.
"""

from __future__ import annotations

from datetime import datetime, timezone

from lambdas.common import ices_dynamo as db
from lambdas.common import sleeper
from lambdas.common.ices import SLOTS, default_week_settings, week_ices
from lambdas.common.logger import get_logger

log = get_logger(__file__)

ICE_FIELDS = ("week", "rosterId", "reason", "slotIndex", "slot", "playerId", "points")


def finalize_week(week: int, refinalize: bool = False) -> dict:
    stored = db.get_week(week)
    settings = default_week_settings(week)
    settings.update({k: stored[k] for k in settings if k in stored})

    ices = week_ices(week, sleeper.matchups(week), SLOTS, settings)
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    counts = {"week": week, "written": 0, "existing": 0, "voided": 0}

    old = db.computed_rows(week) if refinalize else {}
    new_ids = {i["id"] for i in ices}
    for ice_id, row in old.items():
        if ice_id not in new_ids and row["status"] != "voided":
            db.update_ice(ice_id, {"status": "voided", "updatedAt": now})
            counts["voided"] += 1

    for ice in ices:
        prior = old.get(ice["id"])
        if prior:
            status = "owed" if prior["status"] == "voided" else prior["status"]
            db.update_ice(
                ice["id"], {**{k: ice[k] for k in ICE_FIELDS}, "status": status, "updatedAt": now}
            )
            counts["existing"] += 1
        elif db.put_ice(ice, now):
            counts["written"] += 1
        else:
            counts["existing"] += 1

    db.mark_finalized(week, now, overwrite=refinalize)
    log.info(
        "week %d finalized (refinalize=%s): %d written, %d existing, %d voided",
        week,
        refinalize,
        counts["written"],
        counts["existing"],
        counts["voided"],
    )
    return counts
