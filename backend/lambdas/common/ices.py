"""
The ice rule, per "Ice computation spec" in docs/features/smirnoff-league/PLAN.md.

frontend/lib/ices/compute.ts implements the same function; both must pass
fixtures/ices-golden.json. This one is authoritative for the ledger.
"""

from __future__ import annotations

import math

SLOTS = ("QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "FLEX", "K", "DEF")


def default_week_settings(week: int) -> dict:
    return {"iceRulesActive": week <= 14, "lowestScope": "all"}


def _round2(n: float) -> float:
    # JS Math.round, which rounds halves up. Python's round() rounds them to
    # even, and a tie for lowest must break the same way in both languages.
    return math.floor(n * 100 + 0.5) / 100


def week_ices(week: int, matchups: list[dict], slots: list[str], settings: dict) -> list[dict]:
    if not settings["iceRulesActive"]:
        return []

    def ice(roster_id, suffix, reason, slot_index, slot, player_id, points) -> dict:
        return {
            "id": f"W{week:02d}#R{roster_id:02d}#{suffix}",
            "week": week,
            "rosterId": roster_id,
            "reason": reason,
            "slotIndex": slot_index,
            "slot": slot,
            "playerId": player_id,
            "points": points,
        }

    ices = []
    # Sleeper sometimes returns a roster with starters null mid-week. That is
    # missing data, not an empty lineup, so the roster owes nothing (S11).
    known = [m for m in matchups if m["starters"] is not None]

    for m in known:
        rid, starters, points = m["roster_id"], m["starters"], m["starters_points"]
        for i, slot in enumerate(slots):
            player_id = starters[i] if i < len(starters) else "0"
            if player_id == "0":
                ices.append(ice(rid, f"S{i}", "empty", i, slot, None, 0))
            elif i < len(points) and points[i] <= 0:
                ices.append(ice(rid, f"S{i}", "zero", i, slot, player_id, points[i]))

    pool = known
    if settings["lowestScope"] != "all":
        pool = [m for m in known if m["matchup_id"] is not None]
    if pool:
        low = min(_round2(m["points"]) for m in pool)
        for m in pool:
            if _round2(m["points"]) == low:
                ices.append(ice(m["roster_id"], "LOWEST", "lowest", None, None, None, low))

    return sorted(ices, key=lambda i: i["id"])
