import json

import pytest

from lambdas.admin_chug_time.handler import handler as admin_handler
from lambdas.common import ices_dynamo as ices
from lambdas.common.users_dynamo import save_profile
from lambdas.ices_chug_time.handler import handler as user_handler
from lambdas.ledger_get.handler import handler as ledger_handler
from tests.conftest import set_admins
from tests.events import SUB, authorized_event

NOW = "2026-09-21T12:00:00+00:00"
OTHER_SUB = "3f1c2b9a-0000-4000-8000-000000000002"
ADMIN = "boss@example.com"
ADMIN_SUB = "3f1c2b9a-0000-4000-8000-00000000000a"
OWN_ICE = "W01#R06#S4"
OTHER_ICE = "W01#R02#S5"


@pytest.fixture
def league(aws):
    set_admins(aws, ADMIN)
    save_profile(SUB, "Player One", "player.one", 6, "player@example.com")
    save_profile(OTHER_SUB, "Player Two", "player.two", 2, "two@example.com")
    ices.put_ice({"id": OWN_ICE, "week": 1, "rosterId": 6, "reason": "zero"}, NOW)
    ices.put_ice({"id": OTHER_ICE, "week": 1, "rosterId": 2, "reason": "zero"}, NOW)
    return aws


def call(handler, body, path="/ices/chug-time", **kw):
    res = handler(authorized_event(path=path, method="POST", body=body, **kw), None)
    return res["statusCode"], json.loads(res["body"])


def time_it(body, **kw):
    return call(user_handler, body, **kw)


def as_admin(body, handler=user_handler):
    return call(handler, body, email=ADMIN, sub=ADMIN_SUB)


def test_own_ice_defaults_the_chugger_to_the_caller(league):
    status, res = time_it({"iceId": OWN_ICE, "seconds": 9.4})

    assert status == 200
    row = ices.get_ice(OWN_ICE)
    assert row["chugSeconds"] == 9.4
    assert row["chugger"] == {"sub": SUB, "name": "Player One"}
    assert row["timedBy"] == SUB and row["timedAt"]
    assert row["status"] == "owed"
    assert res["data"]["chugger"] == {"name": "Player One"}
    assert "@" not in json.dumps(res["data"]) and SUB not in json.dumps(res["data"])


def test_another_rosters_ice_is_403(league):
    status, _ = time_it({"iceId": OTHER_ICE, "seconds": 9.4})

    assert status == 403
    assert "chugSeconds" not in ices.get_ice(OTHER_ICE)


def test_a_player_cannot_name_someone_else(league):
    status, _ = time_it({"iceId": OWN_ICE, "seconds": 9.4, "chugger": {"name": "My buddy"}})

    assert status == 403
    assert "chugSeconds" not in ices.get_ice(OWN_ICE)


def test_completion_is_untouched(league):
    ices.update_ice(OWN_ICE, {"status": "completed", "completedAt": NOW})
    time_it({"iceId": OWN_ICE, "seconds": 12})

    row = ices.get_ice(OWN_ICE)
    assert (row["status"], row["completedAt"], row["chugSeconds"]) == ("completed", NOW, 12)


@pytest.mark.parametrize(("sent", "stored"), [(9.44, 9.4), (9.45, 9.5), (8, 8), (599.94, 599.9)])
def test_seconds_round_to_a_tenth(league, sent, stored):
    assert time_it({"iceId": OWN_ICE, "seconds": sent})[0] == 200
    assert float(ices.get_ice(OWN_ICE)["chugSeconds"]) == stored


@pytest.mark.parametrize("seconds", [0, 0.04, -1, 599.96, 600, "9.4", True, None])
def test_bad_seconds_are_400(league, seconds):
    status, res = time_it({"iceId": OWN_ICE, "seconds": seconds})

    assert status == 400
    assert res["error"]["detail"]["field"] == "seconds"


def test_unknown_ice_is_404(league):
    assert time_it({"iceId": "W01#R06#S9", "seconds": 5})[0] == 404


def test_a_voided_ice_is_409(league):
    ices.update_ice(OWN_ICE, {"status": "voided"})
    assert time_it({"iceId": OWN_ICE, "seconds": 5})[0] == 409


def test_admin_names_a_free_text_chugger_on_any_ice(league):
    status, _ = as_admin({"iceId": OTHER_ICE, "seconds": 7.25, "chugger": {"name": "  Cousin Vinny  "}})

    assert status == 200
    row = ices.get_ice(OTHER_ICE)
    assert (row["chugSeconds"], row["chugger"], row["timedBy"]) == (7.3, {"name": "Cousin Vinny"}, ADMIN_SUB)


def test_admin_names_a_league_user_by_sub(league):
    as_admin({"iceId": OTHER_ICE, "seconds": 7, "chugger": {"sub": OTHER_SUB, "name": "ignored"}})
    assert ices.get_ice(OTHER_ICE)["chugger"] == {"sub": OTHER_SUB, "name": "Player Two"}


@pytest.mark.parametrize(
    "chugger", [{"name": "x" * 41}, {"name": "   "}, {"sub": "not-a-user"}, "Vinny", {"name": 7}]
)
def test_admin_bad_chugger_is_400(league, chugger):
    status, res = as_admin({"iceId": OTHER_ICE, "seconds": 7, "chugger": chugger})

    assert status == 400
    assert res["error"]["detail"]["field"] == "chugger"


def test_admin_without_a_chugger_keeps_the_one_on_record(league):
    as_admin({"iceId": OTHER_ICE, "seconds": 9, "chugger": {"name": "Cousin Vinny"}})
    as_admin({"iceId": OTHER_ICE, "seconds": 8})

    row = ices.get_ice(OTHER_ICE)
    assert (row["chugSeconds"], row["chugger"]) == (8, {"name": "Cousin Vinny"})


def test_admin_route_takes_a_chugger_too(league):
    status, _ = as_admin(
        {"iceId": OTHER_ICE, "seconds": 11.06, "chugger": {"name": "Cousin Vinny"}}, handler=admin_handler
    )

    assert status == 200
    row = ices.get_ice(OTHER_ICE)
    assert (row["chugSeconds"], row["chugger"], row["updatedBy"]) == (11.1, {"name": "Cousin Vinny"}, ADMIN)


def test_admin_route_is_still_admins_only(league):
    assert call(admin_handler, {"iceId": OWN_ICE, "seconds": 5}, path="/admin/chug-time")[0] == 403


def test_ledger_shows_the_chugger_name_but_no_email_or_sub(league):
    time_it({"iceId": OWN_ICE, "seconds": 9.4})
    as_admin({"iceId": OTHER_ICE, "seconds": 8, "chugger": {"sub": OTHER_SUB}})
    res = ledger_handler(authorized_event(path="/ledger/get"), None)

    by_id = {i["iceId"]: i for i in json.loads(res["body"])["data"]["ices"]}
    assert (by_id[OWN_ICE]["chugSeconds"], by_id[OWN_ICE]["chugger"]) == (9.4, {"name": "Player One"})
    assert by_id[OTHER_ICE]["chugger"] == {"name": "Player Two"}
    assert "@" not in res["body"]
    assert SUB not in res["body"] and OTHER_SUB not in res["body"] and ADMIN_SUB not in res["body"]
