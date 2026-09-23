"""
EventBridge, every 15 minutes: finalize each week ESPN reports fully final,
then reconcile late ices across every finalized week, then send alert emails.

Walks every week up to Sleeper's current one rather than only the current
week, so a week missed during an ESPN or Sleeper outage finalizes on the next
tick with no backfill. Finalized weeks cost one settings query, not a fetch.

Invoke with {"force": true, "week": n} to finalize week n without asking ESPN.
That skips reconciling too, because a new week's deadline comes from ESPN; the
next scheduled tick stores it and reconciles.
"""

from __future__ import annotations

from datetime import datetime, timezone

from lambdas.common import espn, mailer, sleeper
from lambdas.common.finalize import finalize_week
from lambdas.common.ices_dynamo import finalized_weeks
from lambdas.common.late import reconcile
from lambdas.common.logger import get_logger

log = get_logger(__file__)

LAST_WEEK = 17


def handler(event, context):
    event = event or {}
    if event.get("force"):
        week = int(event["week"])
        return {"finalized": [finalize_week(week)], "late": None}

    done = finalized_weeks()
    last = min(sleeper.current_week(), LAST_WEEK)
    weeks = [w for w in range(1, last + 1) if w not in done and espn.week_complete(w)]

    results = [finalize_week(w) for w in weeks]
    log.info("cron_tick: finalized weeks %s", weeks)
    now = datetime.now(timezone.utc)
    late = reconcile(now)
    try:
        mail = mailer.run(now)
    except Exception:  # noqa: BLE001 -- finalize and reconcile have landed; the next tick retries the mail
        log.exception("cron_tick: mailer failed")
        mail = None
    return {"finalized": results, "late": late, "mail": mail}
