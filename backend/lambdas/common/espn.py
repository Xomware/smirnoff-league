"""ESPN's public NFL scoreboard. No auth."""

from __future__ import annotations

import json
import urllib.request

SCOREBOARD = (
    "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week={}"
)


def week_complete(week: int) -> bool:
    with urllib.request.urlopen(SCOREBOARD.format(week), timeout=10) as res:
        events = json.load(res).get("events") or []
    # An empty scoreboard is ESPN not having the week yet, not a finished one.
    return bool(events) and all(e["status"]["type"]["completed"] for e in events)
