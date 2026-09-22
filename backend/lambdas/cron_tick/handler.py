"""
EventBridge, every 15 minutes: finalize each week ESPN reports fully final.

Walks every week up to Sleeper's current one rather than only the current
week, so a week missed during an ESPN or Sleeper outage finalizes on the next
tick with no backfill. Finalized weeks cost one settings query, not a fetch.

Invoke with {"force": true, "week": n} to finalize week n without asking ESPN.
"""

from __future__ import annotations

from lambdas.common import espn, sleeper
from lambdas.common.finalize import finalize_week
from lambdas.common.ices_dynamo import finalized_weeks
from lambdas.common.logger import get_logger

log = get_logger(__file__)

LAST_WEEK = 17


def handler(event, context):
    event = event or {}
    if event.get("force"):
        weeks = [int(event["week"])]
    else:
        done = finalized_weeks()
        last = min(sleeper.current_week(), LAST_WEEK)
        weeks = [w for w in range(1, last + 1) if w not in done and espn.week_complete(w)]

    results = [finalize_week(w) for w in weeks]
    log.info("cron_tick: finalized weeks %s", weeks)
    return {"finalized": results}
