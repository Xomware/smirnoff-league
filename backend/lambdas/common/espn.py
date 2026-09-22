"""ESPN's public NFL scoreboard. No auth."""

from __future__ import annotations

import json
import urllib.request
from datetime import datetime

SCOREBOARD = (
    "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week={}"
)


def _events(week: int) -> list[dict]:
    with urllib.request.urlopen(SCOREBOARD.format(week), timeout=10) as res:
        return json.load(res).get("events") or []


def week_complete(week: int) -> bool:
    events = _events(week)
    # An empty scoreboard is ESPN not having the week yet, not a finished one.
    return bool(events) and all(e["status"]["type"]["completed"] for e in events)


def last_game_utc(week: int) -> datetime | None:
    """Kickoff of the week's last game. ESPN dates look like 2026-09-15T00:15Z."""
    dates = [datetime.fromisoformat(e["date"]) for e in _events(week)]
    return max(dates, default=None)
