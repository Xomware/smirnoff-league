#!/usr/bin/env python3
"""
Ledger admin from a laptop, against the real tables with the default AWS credentials.
Same code path as the /admin/* endpoints, see lambdas/common/ice_admin.py.

    cd backend
    python scripts/ice_admin.py complete 'W04#R02#S5' --at 2026-10-10T18:00:00-04:00
    python scripts/ice_admin.py adjust --week 4 --roster 2 --note "reason"

Late rows catch up on the next cron tick, within 15 minutes.
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lambdas.common import ice_admin
from lambdas.common.api import ApiError

TABLES = {"ICES_TABLE": "smirnoff-ices", "SETTINGS_TABLE": "smirnoff-settings"}
BY = "cli"


def main(argv: list[str] | None = None) -> None:
    for name, value in TABLES.items():
        os.environ.setdefault(name, value)

    parser = argparse.ArgumentParser(prog="ice_admin")
    sub = parser.add_subparsers(dest="command", required=True)
    done = sub.add_parser("complete", help="mark one ice completed")
    done.add_argument("ice_id")
    done.add_argument("--at", type=datetime.fromisoformat, help="ISO time with offset; default now")
    extra = sub.add_parser("adjust", help="add an admin ice")
    extra.add_argument("--week", type=int, required=True, choices=range(1, 18), metavar="1-17")
    extra.add_argument("--roster", type=int, required=True, choices=range(1, 15), metavar="1-14")
    extra.add_argument("--note", required=True)
    args = parser.parse_args(argv)

    try:
        if args.command == "complete":
            ice = ice_admin.set_completed(args.ice_id, True, args.at, BY)
            print(f"{args.ice_id} completed at {ice['completedAt']}")
            return
        note = args.note.strip()
        if not note:
            parser.error("--note must not be blank")
        ice = ice_admin.add(args.week, args.roster, note, BY)
        print(f"{ice['iceId']} added")
    except ApiError as e:
        raise SystemExit(e.message)


if __name__ == "__main__":
    main()
