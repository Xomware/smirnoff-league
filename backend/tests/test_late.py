from datetime import datetime, timedelta, timezone

import pytest

from lambdas.common import late
from lambdas.common.late import deadline_for, late_count, reconcile
from lambdas.cron_tick.handler import handler as cron_tick
from scripts.ice_admin import main as ice_admin
from tests.test_finalize import (  # noqa: F401 (web is a fixture)
    SCHEDULED,
    expected_ids,
    freeze,
    ices_table,
    rows,
    web,
    week_setting,
)

UTC = timezone.utc
MIN = timedelta(minutes=1)
WEEK = timedelta(days=7)
W1_DEADLINE = datetime(2026, 9, 20, 17, tzinfo=UTC)
W2_DEADLINE = datetime(2026, 9, 27, 17, tzinfo=UTC)
PARENT = "W01#R02#S5"


@pytest.fixture(autouse=True)
def no_prepaid_weeks(monkeypatch):
    # Most tests exercise lateness on the golden W1/W2 data, which production
    # treats as paid before launch.
    monkeypatch.setattr(late, "PAID_BEFORE_LAUNCH", ())


def test_deadline_is_the_sunday_after_monday_night():
    assert deadline_for(datetime(2026, 9, 15, 0, 15, tzinfo=UTC)) == W1_DEADLINE


def test_l4_deadline_on_the_day_dst_ends_is_18_utc():
    assert deadline_for(datetime(2026, 10, 27, 0, 15, tzinfo=UTC)) == datetime(
        2026, 11, 1, 18, tzinfo=UTC
    )


@pytest.mark.parametrize(
    "last_game, deadline",
    [
        # A last game at Sunday 13:00 ET itself rolls to the next Sunday.
        (datetime(2026, 9, 20, 17, tzinfo=UTC), datetime(2026, 9, 27, 17, tzinfo=UTC)),
        (datetime(2026, 9, 19, 20, tzinfo=UTC), datetime(2026, 9, 20, 17, tzinfo=UTC)),
    ],
)
def test_deadline_is_strictly_after_the_last_game(last_game, deadline):
    assert deadline_for(last_game) == deadline


@pytest.mark.parametrize(
    "paid, now, expected",
    [
        (W1_DEADLINE - MIN, W1_DEADLINE + 4 * WEEK, 0),  # L1
        (W1_DEADLINE + MIN, W1_DEADLINE + 4 * WEEK, 1),  # L2
        (None, W1_DEADLINE + WEEK + MIN, 2),  # L3
        (W1_DEADLINE, W1_DEADLINE + 4 * WEEK, 0),
        (None, W1_DEADLINE, 0),
        (W1_DEADLINE + WEEK, W1_DEADLINE + 4 * WEEK, 2),
    ],
)
def test_late_count(paid, now, expected):
    assert late_count(W1_DEADLINE, paid, now) == expected


@pytest.mark.parametrize(
    "now, expected",
    [
        # 12:30 EST on Nov 1 is exactly 7x24h after the 13:00 EDT deadline.
        (datetime(2026, 11, 1, 17, 30, tzinfo=UTC), 1),
        (datetime(2026, 11, 1, 18, tzinfo=UTC) - MIN, 1),
        (datetime(2026, 11, 1, 18, tzinfo=UTC), 2),
        (datetime(2026, 11, 8, 18, tzinfo=UTC), 3),
    ],
)
def test_weekly_boundary_stays_at_13_et_across_dst(now, expected):
    deadline = datetime(2026, 10, 25, 17, tzinfo=UTC)
    assert late_count(deadline, None, now) == expected


def finalize_both_weeks():
    """Cron at the fixture's frozen clock: W1 and W2 finalized, deadlines stored, nothing late."""
    cron_tick(SCHEDULED, None)
    assert week_setting(1)["deadlineUtc"] == W1_DEADLINE.isoformat()
    assert week_setting(2)["deadlineUtc"] == W2_DEADLINE.isoformat()
    assert not late_rows()


def late_rows(parent=None):
    return {
        k: v
        for k, v in rows().items()
        if v["reason"] == "late" and (parent is None or v["parentIceId"] == parent)
    }


def owed_late(week):
    return {
        k for k, v in late_rows().items() if v["status"] == "owed" and k.startswith(f"W{week:02d}#")
    }


def set_status(ice_id, status, completed_at=None):
    fields = {"status": status}
    if completed_at:
        fields["completedAt"] = completed_at.isoformat()
    ices_table().update_item(
        Key={"season": "2026", "iceId": ice_id},
        UpdateExpression="SET " + ", ".join(f"#{k} = :{k}" for k in fields),
        ExpressionAttributeNames={f"#{k}": k for k in fields},
        ExpressionAttributeValues={f":{k}": v for k, v in fields.items()},
    )


@pytest.mark.usefixtures("aws", "web")
def test_late_rows_are_one_per_week_late_per_original():
    finalize_both_weeks()
    reconcile(W1_DEADLINE + 8 * timedelta(days=1))

    late = late_rows()
    assert {r["parentIceId"] for r in late.values()} >= expected_ids(1)
    for parent in expected_ids(1):
        assert set(late_rows(parent)) == {f"{parent}#LATE1", f"{parent}#LATE2"}
    row = late[f"{PARENT}#LATE1"]
    assert (row["status"], row["source"], row["reason"], row["week"], row["rosterId"]) == (
        "owed",
        "cron",
        "late",
        1,
        2,
    )


@pytest.mark.usefixtures("aws", "web")
def test_l5_late_ices_never_compound():
    finalize_both_weeks()
    set_status(PARENT, "completed", W1_DEADLINE + MIN)

    reconcile(W1_DEADLINE + 3 * WEEK + 2 * MIN)

    assert set(late_rows(PARENT)) == {f"{PARENT}#LATE1"}
    assert late_rows(PARENT)[f"{PARENT}#LATE1"]["status"] == "owed"
    assert not any(k.count("#LATE") > 1 for k in rows())


@pytest.mark.usefixtures("aws", "web")
def test_l6_backdating_a_completion_voids_its_late_rows():
    finalize_both_weeks()
    reconcile(W1_DEADLINE + 8 * timedelta(days=1))

    ice_admin(["complete", PARENT, "--at", (W1_DEADLINE - MIN).isoformat()])
    counts = reconcile(W1_DEADLINE + 8 * timedelta(days=1))

    assert counts["voided"] == 2
    assert {r["status"] for r in late_rows(PARENT).values()} == {"voided"}
    other = "W01#R12#S9"
    assert {r["status"] for r in late_rows(other).values()} == {"owed"}


@pytest.mark.usefixtures("aws", "web")
def test_completed_late_rows_are_never_touched():
    finalize_both_weeks()
    now = W1_DEADLINE + 8 * timedelta(days=1)
    reconcile(now)
    set_status(f"{PARENT}#LATE2", "completed", now)
    before = late_rows(PARENT)[f"{PARENT}#LATE2"]

    set_status(PARENT, "completed", W1_DEADLINE - MIN)
    reconcile(now)

    assert late_rows(PARENT)[f"{PARENT}#LATE1"]["status"] == "voided"
    assert late_rows(PARENT)[f"{PARENT}#LATE2"] == before


@pytest.mark.usefixtures("aws", "web")
def test_voided_original_voids_its_late_rows_and_undo_revives_them():
    finalize_both_weeks()
    now = W1_DEADLINE + 8 * timedelta(days=1)
    reconcile(now)

    set_status(PARENT, "voided")
    reconcile(now)
    assert {r["status"] for r in late_rows(PARENT).values()} == {"voided"}

    set_status(PARENT, "owed")
    reconcile(now)
    assert {r["status"] for r in late_rows(PARENT).values()} == {"owed"}


@pytest.mark.usefixtures("aws", "web")
def test_reconcile_is_idempotent():
    finalize_both_weeks()
    now = W1_DEADLINE + 8 * timedelta(days=1)
    first_counts = reconcile(now)
    first = rows()

    assert first_counts["created"] == 10 + 3
    assert reconcile(now) == {"created": 0, "revived": 0, "voided": 0}
    assert rows() == first


@pytest.mark.usefixtures("aws", "web")
def test_cron_reconciles_on_every_tick_idempotently(monkeypatch):
    freeze(monkeypatch, W1_DEADLINE + 8 * timedelta(days=1))
    cron_tick(SCHEDULED, None)
    first = rows()
    assert len(owed_late(1)) == 10 and len(owed_late(2)) == 3

    cron_tick(SCHEDULED, None)
    assert rows() == first


@pytest.mark.usefixtures("aws", "web")
def test_force_finalize_skips_reconcile(monkeypatch):
    freeze(monkeypatch, W1_DEADLINE + 8 * timedelta(days=1))
    cron_tick({"force": True, "week": 1}, None)

    assert set(rows()) == expected_ids(1)
    assert "deadlineUtc" not in week_setting(1)


@pytest.mark.usefixtures("aws", "web")
def test_scenario_weeks_paid_before_launch_never_go_late(monkeypatch):
    monkeypatch.setattr(late, "PAID_BEFORE_LAUNCH", (1, 2))
    finalize_both_weeks()
    now = W1_DEADLINE + 8 * timedelta(days=1)
    reconcile(now)

    originals = {k: v for k, v in rows().items() if v["reason"] != "late"}
    assert set(originals) == expected_ids(1) | expected_ids(2)
    for ice_id, row in originals.items():
        deadline = W1_DEADLINE if ice_id.startswith("W01#") else W2_DEADLINE
        assert (row["status"], row["source"], row["completedAt"]) == ("completed", "cron", deadline.isoformat())
    assert owed_late(1) == owed_late(2) == set()
    assert reconcile(now) == {"created": 0, "revived": 0, "voided": 0}


@pytest.mark.usefixtures("aws", "web")
def test_complete_defaults_to_now_and_rejects_an_unknown_ice():
    finalize_both_weeks()
    ice_admin(["complete", PARENT])
    row = rows()[PARENT]
    assert row["status"] == "completed"
    assert datetime.fromisoformat(row["completedAt"]) > W1_DEADLINE - WEEK

    with pytest.raises(SystemExit, match="no ice W01#R99#S0"):
        ice_admin(["complete", "W01#R99#S0"])
    assert "W01#R99#S0" not in rows()


def test_adjust_adds_numbered_admin_ices(aws, capsys):
    ice_admin(["adjust", "--week", "3", "--roster", "7", "--note", "missed the chug deadline"])
    ice_admin(["adjust", "--week", "3", "--roster", "7", "--note", "second one"])

    first, second = rows()["W03#R07#ADMIN1"], rows()["W03#R07#ADMIN2"]
    assert (
        first["reason"],
        first["source"],
        first["status"],
        first["week"],
        first["rosterId"],
    ) == (
        "admin",
        "admin",
        "owed",
        3,
        7,
    )
    assert (first["note"], second["note"]) == ("missed the chug deadline", "second one")
    assert capsys.readouterr().out.splitlines() == ["W03#R07#ADMIN1 added", "W03#R07#ADMIN2 added"]


@pytest.mark.parametrize(
    "args",
    [
        ["adjust", "--week", "0", "--roster", "7", "--note", "x"],
        ["adjust", "--week", "3", "--roster", "15", "--note", "x"],
        ["adjust", "--week", "3", "--roster", "7", "--note", "  "],
        ["complete", PARENT, "--at", "yesterday"],
        ["complete", PARENT, "--at", "2026-09-20T12:00:00"],
    ],
)
def test_ice_admin_rejects_bad_arguments(aws, args):
    with pytest.raises(SystemExit):
        ice_admin(args)
    assert rows() == {}
