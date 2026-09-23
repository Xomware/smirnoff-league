import json
import os

import boto3

from lambdas.common import ice_admin
from lambdas.common import ices_dynamo as db
from lambdas.ledger_get.handler import handler
from tests.events import authorized_event

NOW = "2026-09-21T12:00:00+00:00"
W1_DEADLINE = "2026-09-20T17:00:00+00:00"
# Far enough out that W2 is never overdue whenever the suite runs.
W2_DEADLINE = "2099-01-01T18:00:00+00:00"


def ice(ice_id, week, roster, reason, **extra):
    db.put_ice({"id": ice_id, "week": week, "rosterId": roster, "reason": reason, **extra}, NOW)


def seed():
    settings = boto3.resource("dynamodb").Table(os.environ["SETTINGS_TABLE"])
    settings.put_item(Item={"season": "2026", "key": "WEEK#01", "finalizedAt": NOW, "deadlineUtc": W1_DEADLINE})
    settings.put_item(Item={"season": "2026", "key": "WEEK#02", "finalizedAt": NOW, "deadlineUtc": W2_DEADLINE})
    settings.put_item(Item={"season": "2026", "key": "WEEK#03", "iceRulesActive": False, "lowestScope": "played"})

    ice("W01#R02#S5", 1, 2, "zero", points=0.0)
    ice("W01#R06#LOWEST", 1, 6, "lowest", points=61.4)
    ice("W01#R06#S4", 1, 6, "zero", points=0.0)
    ice("W01#R06#LATE1", 1, 6, "late", parentIceId="W01#R06#S4")
    ice("W01#R08#S5", 1, 8, "zero", points=-1.0)
    ice("W02#R13#S3", 2, 13, "zero", points=0.0)
    db.update_ice("W01#R02#S5", {"status": "completed", "completedAt": "2026-09-19T00:00:00+00:00"})
    db.update_ice("W01#R06#LATE1", {"status": "completed", "completedAt": "2026-09-21T00:00:00+00:00"})
    db.update_ice("W01#R08#S5", {"status": "voided"})


def call(event=None):
    res = handler(event or authorized_event(path="/ledger/get"), None)
    return res["statusCode"], json.loads(res["body"])


def test_envelope_carries_rows_weeks_and_summary(aws):
    seed()
    status, payload = call()

    assert status == 200
    assert payload["error"] is None and payload["meta"] is None
    data = payload["data"]
    assert set(data) == {"ices", "weeks", "summary", "toiletByes"}
    defaults = {"iceRulesActive": True, "lowestScope": "all"}
    assert data["weeks"] == [
        {"week": 1, "finalizedAt": NOW, "deadlineUtc": W1_DEADLINE, **defaults},
        {"week": 2, "finalizedAt": NOW, "deadlineUtc": W2_DEADLINE, **defaults},
        {"week": 3, "finalizedAt": None, "deadlineUtc": None, "iceRulesActive": False, "lowestScope": "played"},
    ]
    assert data["toiletByes"] == [13, 14]
    lowest = next(i for i in data["ices"] if i["iceId"] == "W01#R06#LOWEST")
    assert lowest["points"] == 61.4 and lowest["status"] == "owed"


def test_voided_rows_are_excluded(aws):
    seed()
    _, payload = call()

    ids = [i["iceId"] for i in payload["data"]["ices"]]
    assert "W01#R08#S5" not in ids
    assert len(ids) == 5
    assert all(s["rosterId"] != 8 for s in payload["data"]["summary"])


def test_summary_counts_owed_completed_late_and_overdue(aws):
    seed()
    _, payload = call()

    assert payload["data"]["summary"] == [
        {"rosterId": 2, "owed": 0, "completed": 1, "late": 0, "lateOwed": 0, "overdue": 0},
        # Both W1 originals are unpaid past the W1 deadline; the late ice is paid.
        {"rosterId": 6, "owed": 2, "completed": 0, "late": 1, "lateOwed": 0, "overdue": 2},
        {"rosterId": 13, "owed": 1, "completed": 0, "late": 0, "lateOwed": 0, "overdue": 0},
    ]


def test_toilet_byes_come_from_settings(aws):
    settings = boto3.resource("dynamodb").Table(os.environ["SETTINGS_TABLE"])
    settings.put_item(Item={"season": "2026", "key": "TOILET_BRACKET", "byes": [9, 12]})
    _, payload = call()

    assert payload["data"]["toiletByes"] == [9, 12]


def test_missing_claims_is_401(aws):
    event = authorized_event(path="/ledger/get")
    del event["requestContext"]["authorizer"]
    status, payload = call(event)

    assert status == 401
    assert payload["data"] is None


def test_ledger_never_carries_an_email(aws):
    seed()
    ice_admin.set_chug("W01#R02#S5", 4.2, "admin@example.com")
    ice_admin.set_completed("W01#R06#S4", True, None, "admin@example.com", "paid up")
    res = handler(authorized_event(path="/ledger/get"), None)

    assert "@" not in res["body"]
    assert all("updatedBy" not in i for i in json.loads(res["body"])["data"]["ices"])
