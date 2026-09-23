import json
from datetime import datetime, timedelta, timezone

import pytest

from lambdas.admin_chug_time.handler import handler as chug_time
from lambdas.admin_ice_adjust.handler import handler as ice_adjust
from lambdas.admin_ice_complete.handler import handler as ice_complete
from lambdas.admin_settings.handler import handler as settings
from lambdas.common import ice_admin
from lambdas.common.late import reconcile
from tests.conftest import set_admins
from tests.events import authorized_event
from tests.test_finalize import (  # noqa: F401 (web is a fixture)
    ADMIN,
    expected_ids,
    finalize,
    rows,
    settings_table,
    web,
)

UTC = timezone.utc
PLAYER = "player@example.com"
ICE = "W03#R02#S5"
# W3's last game in the fixture kicks off Mon 2026-09-28 20:15 ET.
W3_DEADLINE = datetime(2026, 10, 4, 17, tzinfo=UTC)
NOW = W3_DEADLINE + timedelta(days=8)

ROUTES = {
    "/admin/ice-adjust": ice_adjust,
    "/admin/ice-complete": ice_complete,
    "/admin/chug-time": chug_time,
    "/admin/settings": settings,
}


def call(path, body, email=ADMIN):
    event = authorized_event(path=path, method="POST", body=body, email=email)
    res = ROUTES[path](event, None)
    return res["statusCode"], json.loads(res["body"])


@pytest.fixture
def admin(aws, web, monkeypatch):
    class Frozen(datetime):
        @classmethod
        def now(cls, tz=None):
            return NOW

    monkeypatch.setattr(ice_admin, "datetime", Frozen)
    set_admins(aws, ADMIN)
    assert finalize({"week": 3})[0] == 200


def setting(key):
    return settings_table().get_item(Key={"season": "2026", "key": key}).get("Item")


@pytest.mark.parametrize("path", ROUTES)
def test_non_admin_gets_403(admin, path):
    before = rows()
    status, body = call(path, {"iceId": ICE, "completed": True}, email=PLAYER)
    assert status == 403
    assert body["error"]["message"] == "Admins only"
    assert rows() == before


def test_add_then_void_an_admin_ice(admin):
    status, body = call(
        "/admin/ice-adjust", {"action": "add", "week": 3, "rosterId": 7, "note": "skipped chug"}
    )
    assert status == 200
    assert body["data"]["iceId"] == "W03#R07#ADMIN1"
    _, body = call("/admin/ice-adjust", {"action": "add", "week": 3, "rosterId": 7, "note": "again"})
    assert body["data"]["iceId"] == "W03#R07#ADMIN2"

    row = rows()["W03#R07#ADMIN1"]
    assert (row["reason"], row["source"], row["status"], row["note"], row["updatedBy"]) == (
        "admin",
        "admin",
        "owed",
        "skipped chug",
        ADMIN,
    )
    assert row["updatedAt"]

    status, body = call(
        "/admin/ice-adjust", {"action": "void", "iceId": "W03#R07#ADMIN1", "note": "mistake"}
    )
    assert status == 200
    row = rows()["W03#R07#ADMIN1"]
    assert (row["status"], row["note"], row["updatedBy"]) == ("voided", "mistake", ADMIN)
    assert body["data"]["status"] == "voided"


@pytest.mark.parametrize(
    "body, field",
    [
        ({"week": 3, "rosterId": 7, "note": "x"}, "action"),
        ({"action": "remove", "iceId": ICE, "note": "x"}, "action"),
        ({"action": "add", "week": 18, "rosterId": 7, "note": "x"}, "week"),
        ({"action": "add", "week": True, "rosterId": 7, "note": "x"}, "week"),
        ({"action": "add", "week": 3, "rosterId": 15, "note": "x"}, "rosterId"),
        ({"action": "add", "week": 3, "rosterId": 7, "note": "  "}, "note"),
        ({"action": "void", "iceId": ICE}, "note"),
        ({"action": "void", "note": "x"}, "iceId"),
    ],
)
def test_ice_adjust_rejects_a_bad_body(admin, body, field):
    before = rows()
    status, res = call("/admin/ice-adjust", body)
    assert status == 400
    assert res["error"]["detail"]["field"] == field
    assert rows() == before


def test_void_an_unknown_ice_is_404(admin):
    status, _ = call("/admin/ice-adjust", {"action": "void", "iceId": "W03#R99#S0", "note": "x"})
    assert status == 404
    assert "W03#R99#S0" not in rows()


def test_complete_undo_and_backdate(admin):
    status, body = call("/admin/ice-complete", {"iceId": ICE, "completed": True, "note": "saw it"})
    assert status == 200
    row = rows()[ICE]
    assert (row["status"], row["updatedBy"], row["note"]) == ("completed", ADMIN, "saw it")
    assert datetime.fromisoformat(row["completedAt"]).tzinfo is not None
    assert body["data"]["completedAt"] == row["completedAt"]

    assert call("/admin/ice-complete", {"iceId": ICE, "completed": False})[0] == 200
    row = rows()[ICE]
    assert row["status"] == "owed"
    assert "completedAt" not in row

    at = "2026-10-03T21:30:00-04:00"
    assert call("/admin/ice-complete", {"iceId": ICE, "completed": True, "at": at})[0] == 200
    assert rows()[ICE]["completedAt"] == "2026-10-04T01:30:00+00:00"


@pytest.mark.parametrize(
    "body, field",
    [
        ({"completed": True}, "iceId"),
        ({"iceId": ICE}, "completed"),
        ({"iceId": ICE, "completed": "yes"}, "completed"),
        ({"iceId": ICE, "completed": True, "at": "yesterday"}, "at"),
        ({"iceId": ICE, "completed": True, "at": "2026-10-03T21:30:00"}, "at"),
        ({"iceId": ICE, "completed": True, "at": "2999-01-01T00:00:00Z"}, "at"),
        ({"iceId": ICE, "completed": False, "at": "2026-10-03T21:30:00Z"}, "at"),
    ],
)
def test_ice_complete_rejects_a_bad_body(admin, body, field):
    before = rows()
    status, res = call("/admin/ice-complete", body)
    assert status == 400
    assert res["error"]["detail"]["field"] == field
    assert rows() == before


def test_complete_an_unknown_ice_is_404(admin):
    assert call("/admin/ice-complete", {"iceId": "W03#R99#S0", "completed": True})[0] == 404
    assert "W03#R99#S0" not in rows()


def test_complete_a_voided_ice_is_409(admin):
    call("/admin/ice-adjust", {"action": "void", "iceId": ICE, "note": "stat fix"})
    assert call("/admin/ice-complete", {"iceId": ICE, "completed": False})[0] == 409
    assert rows()[ICE]["status"] == "voided"


def test_chug_time(admin):
    status, body = call("/admin/chug-time", {"iceId": ICE, "seconds": 7.42})
    assert status == 200
    row = rows()[ICE]
    assert (float(row["chugSeconds"]), row["updatedBy"]) == (7.42, ADMIN)
    assert body["data"]["chugSeconds"] == 7.42


@pytest.mark.parametrize("seconds", [0, -3, 600, 601, "7", True, None])
def test_chug_time_rejects_bad_seconds(admin, seconds):
    status, res = call("/admin/chug-time", {"iceId": ICE, "seconds": seconds})
    assert status == 400
    assert res["error"]["detail"]["field"] == "seconds"
    assert "chugSeconds" not in rows()[ICE]


def test_chug_time_on_an_unknown_ice_is_404(admin):
    assert call("/admin/chug-time", {"iceId": "W03#R99#S0", "seconds": 5})[0] == 404


def test_week_settings_keep_finalize_fields(admin):
    finalized_at = setting("WEEK#03")["finalizedAt"]
    status, body = call(
        "/admin/settings",
        {"week": 3, "iceRulesActive": False, "lowestScope": "played", "note": "bye week"},
    )
    assert status == 200
    row = setting("WEEK#03")
    assert (row["iceRulesActive"], row["lowestScope"], row["finalizedAt"]) == (
        False,
        "played",
        finalized_at,
    )
    assert (row["updatedBy"], row["note"]) == (ADMIN, "bye week")
    assert body["data"]["lowestScope"] == "played"

    assert call("/admin/settings", {"week": 3, "lowestScope": "all"})[0] == 200
    assert (setting("WEEK#03")["iceRulesActive"], setting("WEEK#03")["lowestScope"]) == (
        False,
        "all",
    )


def test_toilet_byes(admin):
    status, body = call("/admin/settings", {"toiletByes": [9, 14]})
    assert status == 200
    row = setting("TOILET_BRACKET")
    assert ([int(b) for b in row["byes"]], row["updatedBy"]) == ([9, 14], ADMIN)
    assert body["data"]["byes"] == [9, 14]


@pytest.mark.parametrize(
    "body, field",
    [
        ({}, "week"),
        ({"week": 3}, "iceRulesActive"),
        ({"week": 0, "iceRulesActive": True}, "week"),
        ({"week": 3, "iceRulesActive": "false"}, "iceRulesActive"),
        ({"week": 3, "lowestScope": "some"}, "lowestScope"),
        ({"week": 3, "toiletByes": [13, 14]}, "toiletByes"),
        ({"toiletByes": [13]}, "toiletByes"),
        ({"toiletByes": [13, 13]}, "toiletByes"),
        ({"toiletByes": [8, 14]}, "toiletByes"),
        ({"toiletByes": "13,14"}, "toiletByes"),
    ],
)
def test_settings_rejects_a_bad_body(admin, body, field):
    before = (setting("WEEK#03"), setting("TOILET_BRACKET"))
    status, res = call("/admin/settings", body)
    assert status == 400
    assert res["error"]["detail"]["field"] == field
    assert (setting("WEEK#03"), setting("TOILET_BRACKET")) == before


def late_statuses(parent):
    return {k: v["status"] for k, v in rows().items() if v.get("parentIceId") == parent}


def test_scenario_backdated_completion_voids_late_rows_and_undo_revives_them(admin):
    now = NOW
    counts = reconcile(now)
    assert counts["created"] == 2 * len(expected_ids(1))
    assert late_statuses(ICE) == {f"{ICE}#LATE1": "owed", f"{ICE}#LATE2": "owed"}

    before_deadline = (W3_DEADLINE - timedelta(minutes=1)).isoformat()
    status, _ = call("/admin/ice-complete", {"iceId": ICE, "completed": True, "at": before_deadline})
    assert status == 200
    assert reconcile(now)["voided"] == 2
    assert set(late_statuses(ICE).values()) == {"voided"}
    assert set(late_statuses("W03#R12#S9").values()) == {"owed"}

    assert call("/admin/ice-complete", {"iceId": ICE, "completed": False})[0] == 200
    assert reconcile(now)["revived"] == 2
    assert set(late_statuses(ICE).values()) == {"owed"}
