"""Sleeper's public API. No auth; stdlib only because the layer ships no HTTP client."""

from __future__ import annotations

import json
import urllib.request

BASE = "https://api.sleeper.app/v1"
LEAGUE_ID = "1394061072742227968"


def _get(path: str):
    with urllib.request.urlopen(BASE + path, timeout=10) as res:
        return json.load(res)


def current_week() -> int:
    return int(_get("/state/nfl")["week"])


def matchups(week: int) -> list[dict]:
    return _get(f"/league/{LEAGUE_ID}/matchups/{week}")
