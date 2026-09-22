"""Pulls W1/W2 matchups from Sleeper and writes fixtures/ices-golden.json.

Run from anywhere: python3 backend/scripts/build_ices_fixture.py
"""

import json
from pathlib import Path
from urllib.request import urlopen

LEAGUE_ID = "1394061072742227968"
BASE = "https://api.sleeper.app/v1"
SLOTS = ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "FLEX", "K", "DEF"]
KEYS = ["roster_id", "matchup_id", "points", "starters", "starters_points"]
OUT = Path(__file__).resolve().parents[2] / "fixtures" / "ices-golden.json"

# Hand-verified against the live league, keyed by the starter who zeroed.
# Deliberately not derived from the ice rule, so the fixture can catch a wrong
# implementation instead of agreeing with it.
EXPECTED = {
    1: {"zero": ["7553", "8121", "12517", "HOU"], "lowest": "8121"},
    2: {"zero": ["9493", "4983"], "lowest": "4983"},
}


def fetch(week):
    with urlopen(f"{BASE}/league/{LEAGUE_ID}/matchups/{week}") as res:
        rows = json.load(res)
    return sorted(({k: row[k] for k in KEYS} for row in rows), key=lambda r: r["roster_id"])


def starter(rows, player_id):
    return next(
        (row, row["starters"].index(player_id)) for row in rows if player_id in row["starters"]
    )


def ice_id(week, roster_id, suffix):
    return f"W{week:02d}#R{roster_id:02d}#{suffix}"


def expected_ices(week, rows):
    ices = []
    for player_id in EXPECTED[week]["zero"]:
        row, i = starter(rows, player_id)
        ices.append({
            "id": ice_id(week, row["roster_id"], f"S{i}"),
            "week": week,
            "rosterId": row["roster_id"],
            "reason": "zero",
            "slotIndex": i,
            "slot": SLOTS[i],
            "playerId": player_id,
            "points": row["starters_points"][i],
        })
    row, _ = starter(rows, EXPECTED[week]["lowest"])
    ices.append({
        "id": ice_id(week, row["roster_id"], "LOWEST"),
        "week": week,
        "rosterId": row["roster_id"],
        "reason": "lowest",
        "slotIndex": None,
        "slot": None,
        "playerId": None,
        "points": round(row["points"], 2),
    })
    return sorted(ices, key=lambda ice: ice["id"])


def main():
    weeks = []
    for week in EXPECTED:
        rows = fetch(week)
        weeks.append({
            "week": week,
            "settings": {"iceRulesActive": True, "lowestScope": "all"},
            "matchups": rows,
            "expected": expected_ices(week, rows),
        })
    fixture = {
        "$comment": [
            "Golden ice results. frontend/lib/ices/compute.ts and backend ices.py both read this file.",
            "Built by backend/scripts/build_ices_fixture.py. Keyed by roster_id and Sleeper player id only.",
            "Expected ices are hand-verified against the live league, not derived from the ice rule.",
        ],
        "slots": SLOTS,
        "weeks": weeks,
    }
    OUT.write_text(json.dumps(fixture, indent=2) + "\n")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
