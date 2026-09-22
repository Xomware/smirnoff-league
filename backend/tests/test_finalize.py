import io
import json
import os
import urllib.request
from datetime import datetime, timedelta, timezone

import boto3
import pytest
from boto3.dynamodb.conditions import Key

from lambdas.admin_finalize.handler import handler as admin_finalize
from lambdas.cron_tick import handler as cron_module
from lambdas.cron_tick.handler import handler as cron_tick
from tests.conftest import set_admins
from tests.events import authorized_event
from tests.test_ices import golden_week

SLEEPER = "https://api.sleeper.app/v1"
MATCHUPS = SLEEPER + "/league/1394061072742227968/matchups/{}"
ESPN = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week={}"
SCHEDULED = {"source": "aws.events", "detail-type": "Scheduled Event", "detail": {}}
ADMIN = "boss@example.com"
# After W1's Monday night game and before its deadline, so no ice is late yet.
BEFORE_W1_DEADLINE = datetime(2026, 9, 16, 12, tzinfo=timezone.utc)


def scoreboard(last_game, *completed):
    """Events a day apart, ending at last_game, in ESPN's minute-precision format."""
    end = datetime.fromisoformat(last_game)
    return {
        "events": [
            {
                "date": (end - timedelta(days=len(completed) - 1 - i)).strftime("%Y-%m-%dT%H:%MZ"),
                "status": {"type": {"completed": c}},
            }
            for i, c in enumerate(completed)
        ]
    }


def freeze(monkeypatch, now):
    class Frozen(datetime):
        @classmethod
        def now(cls, tz=None):
            return now

    monkeypatch.setattr(cron_module, "datetime", Frozen)


@pytest.fixture
def web(monkeypatch):
    """Serves canned JSON by URL and records every URL requested. Any other URL fails the test."""
    routes = {
        SLEEPER + "/state/nfl": {"week": 3, "season": "2026"},
        MATCHUPS.format(1): golden_week(1)["matchups"],
        MATCHUPS.format(2): golden_week(2)["matchups"],
        MATCHUPS.format(3): golden_week(1)["matchups"],
        ESPN.format(1): scoreboard("2026-09-15T00:15Z", True, True),
        ESPN.format(2): scoreboard("2026-09-22T00:15Z", True, True),
        ESPN.format(3): scoreboard("2026-09-29T00:15Z", True, False),
    }
    requested = []

    def urlopen(url, timeout=None):
        assert timeout, "every fetch needs a timeout"
        requested.append(url)
        assert url in routes, f"unexpected fetch {url}"
        return io.BytesIO(json.dumps(routes[url]).encode())

    monkeypatch.setattr(urllib.request, "urlopen", urlopen)
    freeze(monkeypatch, BEFORE_W1_DEADLINE)
    return routes, requested


def ices_table():
    return boto3.resource("dynamodb").Table(os.environ["ICES_TABLE"])


def settings_table():
    return boto3.resource("dynamodb").Table(os.environ["SETTINGS_TABLE"])


def rows(week=None):
    items = ices_table().query(KeyConditionExpression=Key("season").eq("2026"))["Items"]
    return {i["iceId"]: i for i in items if week is None or i["iceId"].startswith(f"W{week:02d}#")}


def week_setting(week):
    return settings_table().get_item(Key={"season": "2026", "key": f"WEEK#{week:02d}"}).get("Item")


def finalize(body, email=ADMIN):
    event = authorized_event(path="/admin/finalize", method="POST", body=body, email=email)
    res = admin_finalize(event, None)
    return res["statusCode"], json.loads(res["body"])


def expected_ids(week):
    return {i["id"] for i in golden_week(week)["expected"]}


def test_admin_finalize_writes_the_week_once(aws, web):
    set_admins(aws, ADMIN)

    status, body = finalize({"week": 1})
    assert status == 200
    assert body["data"]["written"] == 5
    first = rows()
    assert (
        set(first)
        == expected_ids(1)
        == {
            "W01#R02#S5",
            "W01#R06#LOWEST",
            "W01#R06#S4",
            "W01#R08#S5",
            "W01#R12#S9",
        }
    )
    doubs = first["W01#R06#S4"]
    assert (doubs["status"], doubs["source"], doubs["reason"]) == ("owed", "cron", "zero")
    assert (doubs["playerId"], doubs["slot"], doubs["slotIndex"], doubs["rosterId"]) == (
        "8121",
        "WR",
        4,
        6,
    )
    assert float(first["W01#R06#LOWEST"]["points"]) == 91.46
    assert week_setting(1)["finalizedAt"]

    status, body = finalize({"week": 1})
    assert status == 200
    assert (body["data"]["written"], body["data"]["existing"]) == (0, 5)
    assert rows() == first


def test_admin_finalize_rejects_a_non_admin(aws, web):
    set_admins(aws, ADMIN)
    assert finalize({"week": 1}, email="player@example.com")[0] == 403
    assert rows() == {}


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"week": 0},
        {"week": 18},
        {"week": "1"},
        {"week": True},
        {"week": 1, "refinalize": "yes"},
    ],
)
def test_admin_finalize_rejects_a_bad_body(aws, web, body):
    set_admins(aws, ADMIN)
    assert finalize(body)[0] == 400
    assert rows() == {}


def seed_hand_rows():
    """An admin ice and a late ice, neither of which re-finalize may touch."""
    for item in (
        {"iceId": "W01#R03#ADMIN1", "reason": "admin", "source": "admin", "status": "owed"},
        {"iceId": "W01#R02#S5#LATE1", "reason": "late", "source": "cron", "status": "owed"},
    ):
        ices_table().put_item(Item={"season": "2026", "week": 1, "rosterId": 3, **item})


def test_refinalize_voids_computed_rows_only(aws, web):
    set_admins(aws, ADMIN)
    finalize({"week": 1})
    seed_hand_rows()
    before = rows()
    settings_table().put_item(Item={"season": "2026", "key": "WEEK#01", "iceRulesActive": False})

    status, body = finalize({"week": 1, "refinalize": True})

    assert status == 200
    assert body["data"]["voided"] == 5
    after = rows()
    for ice_id in expected_ids(1):
        assert after[ice_id]["status"] == "voided"
    for ice_id in ("W01#R03#ADMIN1", "W01#R02#S5#LATE1"):
        assert after[ice_id] == before[ice_id]


def test_refinalize_recomputes_and_keeps_completions(aws, web):
    set_admins(aws, ADMIN)
    finalize({"week": 1})
    seed_hand_rows()
    ices_table().update_item(
        Key={"season": "2026", "iceId": "W01#R06#S4"},
        UpdateExpression="SET #s = :c",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={":c": "completed"},
    )
    # A stat correction since finalize: Kyle Pitts now has 5 points.
    routes, _ = web
    matchups = json.loads(json.dumps(routes[MATCHUPS.format(1)]))
    pitts = next(m for m in matchups if "7553" in m["starters"])
    pitts["starters_points"][pitts["starters"].index("7553")] = 5.0
    routes[MATCHUPS.format(1)] = matchups

    status, body = finalize({"week": 1, "refinalize": True})

    assert status == 200
    assert body["data"]["voided"] == 1
    after = rows(1)
    assert after["W01#R02#S5"]["status"] == "voided"
    assert after["W01#R06#S4"]["status"] == "completed"
    assert {after[i]["status"] for i in expected_ids(1) - {"W01#R02#S5", "W01#R06#S4"}} == {"owed"}
    assert after["W01#R02#S5#LATE1"]["status"] == "owed"


def test_refinalize_revives_a_row_it_voided(aws, web):
    set_admins(aws, ADMIN)
    finalize({"week": 1})
    settings_table().put_item(Item={"season": "2026", "key": "WEEK#01", "iceRulesActive": False})
    finalize({"week": 1, "refinalize": True})
    settings_table().delete_item(Key={"season": "2026", "key": "WEEK#01"})

    assert finalize({"week": 1, "refinalize": True})[0] == 200
    assert {r["status"] for r in rows().values()} == {"owed"}


def test_cron_finalizes_only_weeks_espn_reports_final(aws, web):
    _, requested = web
    cron_tick(SCHEDULED, None)

    assert set(rows()) == expected_ids(1) | expected_ids(2)
    assert week_setting(1)["finalizedAt"] and week_setting(2)["finalizedAt"]
    assert week_setting(3) is None
    assert MATCHUPS.format(3) not in requested


def test_cron_second_tick_writes_nothing_and_skips_finalized_weeks(aws, web):
    _, requested = web
    cron_tick(SCHEDULED, None)
    first = rows()
    requested.clear()

    cron_tick(SCHEDULED, None)

    assert rows() == first
    assert ESPN.format(1) not in requested and ESPN.format(2) not in requested
    assert ESPN.format(3) in requested


def test_cron_treats_a_week_with_no_events_as_unfinished(aws, web):
    routes, _ = web
    routes[ESPN.format(2)] = {"events": []}
    cron_tick(SCHEDULED, None)

    assert set(rows()) == expected_ids(1)
    assert week_setting(2) is None


def test_cron_reads_week_settings(aws, web):
    settings_table().put_item(Item={"season": "2026", "key": "WEEK#01", "iceRulesActive": False})
    cron_tick(SCHEDULED, None)

    assert rows(1) == {}
    assert week_setting(1)["finalizedAt"]
    assert week_setting(1)["iceRulesActive"] is False


def test_cron_force_finalizes_one_week_without_espn(aws, web):
    _, requested = web
    cron_tick({"force": True, "week": 3}, None)

    assert set(rows()) == {i.replace("W01#", "W03#") for i in expected_ids(1)}
    assert not any("espn" in url for url in requested)
