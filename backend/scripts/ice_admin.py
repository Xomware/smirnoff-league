#!/usr/bin/env python3
"""
Ledger admin from a laptop, against the real tables with the default AWS credentials.

    cd backend
    python scripts/ice_admin.py complete 'W04#R02#S5' --at 2026-10-10T18:00:00-04:00
    python scripts/ice_admin.py adjust --week 4 --roster 2 --note "reason"

Late rows catch up on the next cron tick, within 15 minutes.
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lambdas.common import ices_dynamo as db
from lambdas.common.finalize import finalize_week
from lambdas.common.late import week_deadlines

TABLES = {"ICES_TABLE": "smirnoff-ices", "SETTINGS_TABLE": "smirnoff-settings"}


def aware(value: str) -> datetime:
    at = datetime.fromisoformat(value)
    if at.tzinfo is None:
        raise ValueError("needs a UTC offset")
    return at.astimezone(timezone.utc)


def stamp(at: datetime | None = None) -> str:
    return (at or datetime.now(timezone.utc)).isoformat(timespec="seconds")


def complete(ice_id: str, at: datetime | None) -> None:
    if db.get_ice(ice_id) is None:
        raise SystemExit(f"no ice {ice_id}")
    completed_at = stamp(at)
    db.update_ice(
        ice_id, {"status": "completed", "completedAt": completed_at, "updatedAt": stamp()}
    )
    print(f"{ice_id} completed at {completed_at}")


def adjust(week: int, roster: int, note: str) -> None:
    prefix = f"W{week:02d}#R{roster:02d}#ADMIN"
    n = 1 + sum(1 for i in db.season_ices() if i["iceId"].startswith(prefix))
    ice = {"id": f"{prefix}{n}", "week": week, "rosterId": roster, "reason": "admin", "note": note}
    if not db.put_ice(ice, stamp(), source="admin"):
        raise SystemExit(f"{ice['id']} already exists")
    print(f"{ice['id']} added")


def main(argv: list[str] | None = None) -> None:
    for name, value in TABLES.items():
        os.environ.setdefault(name, value)

    parser = argparse.ArgumentParser(prog="ice_admin")
    sub = parser.add_subparsers(dest="command", required=True)
    done = sub.add_parser("complete", help="mark one ice completed")
    done.add_argument("ice_id")
    done.add_argument("--at", type=aware, help="ISO time with offset; default now")
    extra = sub.add_parser("adjust", help="add an admin ice")
    extra.add_argument("--week", type=int, required=True, choices=range(1, 18), metavar="1-17")
    extra.add_argument("--roster", type=int, required=True, choices=range(1, 15), metavar="1-14")
    extra.add_argument("--note", required=True)
    args = parser.parse_args(argv)

    if args.command == "complete":
        complete(args.ice_id, args.at)
    else:
        note = args.note.strip()
        if not note:
            parser.error("--note must not be blank")
        adjust(args.week, args.roster, note)


if __name__ == "__main__":
    main()
