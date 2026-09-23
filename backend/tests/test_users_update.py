import json

import pytest

from lambdas.users_me.handler import handler as users_me
from lambdas.users_update.handler import handler as users_update
from tests.conftest import set_admins
from tests.events import authorized_event

VALID = {"name": "Player One", "username": "player.one_1", "rosterId": 7}


def update(body, **kw):
    res = users_update(authorized_event(path="/users/update", method="POST", body=body, **kw), None)
    return res["statusCode"], json.loads(res["body"])


def me(**kw):
    res = users_me(authorized_event(**kw), None)
    return res["statusCode"], json.loads(res["body"])


def test_update_round_trips(aws):
    status, body = update(VALID)
    assert status == 200
    saved = body["data"]
    assert {k: saved[k] for k in ("name", "username", "rosterId")} == VALID
    assert saved["createdAt"] == saved["updatedAt"]

    _, got = me()
    assert got["data"]["profile"] == saved


def test_second_update_keeps_created_at(aws):
    _, first = update(VALID)
    _, second = update({**VALID, "name": "  Renamed  ", "rosterId": 3})
    assert second["data"]["createdAt"] == first["data"]["createdAt"]
    assert second["data"]["name"] == "Renamed"
    assert second["data"]["rosterId"] == 3


def test_two_users_may_claim_the_same_roster(aws):
    assert update(VALID)[0] == 200
    other = {"sub": "3f1c2b9a-0000-4000-8000-000000000002", "email": "co@example.com"}
    assert update(VALID, **other)[0] == 200


@pytest.mark.parametrize(
    ("patch", "field"),
    [
        ({"name": None}, "name"),
        ({"name": "   "}, "name"),
        ({"name": "x" * 41}, "name"),
        ({"name": 12}, "name"),
        ({"username": None}, "username"),
        ({"username": "a"}, "username"),
        ({"username": "a" * 21}, "username"),
        ({"username": "bad name"}, "username"),
        ({"username": "émile"}, "username"),
        ({"rosterId": None}, "rosterId"),
        ({"rosterId": 0}, "rosterId"),
        ({"rosterId": 15}, "rosterId"),
        ({"rosterId": "7"}, "rosterId"),
        ({"rosterId": 7.5}, "rosterId"),
        ({"rosterId": True}, "rosterId"),
    ],
)
def test_invalid_field_is_400(aws, patch, field):
    body = {k: v for k, v in {**VALID, **patch}.items() if v is not None}
    status, res = update(body)
    assert status == 400
    assert res["data"] is None
    assert res["error"]["detail"] == {"field": field}
    assert field in res["error"]["message"]
    assert me()[1]["data"]["profile"] is None


def test_non_object_body_is_400(aws):
    event = authorized_event(path="/users/update", method="POST")
    event["body"] = "[1, 2]"
    assert users_update(event, None)["statusCode"] == 400


def test_new_user_onboards_and_is_not_admin(aws):
    set_admins(aws, "boss@example.com")
    assert update(VALID)[0] == 200
    status, body = me()
    assert status == 200
    assert body["data"]["profile"]["username"] == "player.one_1"
    assert body["data"]["isAdmin"] is False


def test_listed_user_onboards_and_is_admin(aws):
    set_admins(aws, "boss@example.com,player@EXAMPLE.com")
    assert update(VALID)[0] == 200
    _, body = me()
    assert body["data"]["profile"]["rosterId"] == 7
    assert body["data"]["isAdmin"] is True


def test_seen_at_updates_on_its_own_and_round_trips(aws):
    _, first = update(VALID)
    status, body = update({"notificationsSeenAt": "2025-09-25T12:00:00-04:00"})
    assert status == 200
    saved = body["data"]
    assert saved["notificationsSeenAt"] == "2025-09-25T12:00:00-04:00"
    assert {k: saved[k] for k in ("name", "username", "rosterId")} == VALID
    assert saved["createdAt"] == first["data"]["createdAt"]
    assert me()[1]["data"]["profile"] == saved


def test_profile_update_keeps_seen_at(aws):
    update({**VALID, "notificationsSeenAt": "2025-09-25T16:00:00Z"})
    _, body = update({**VALID, "name": "Renamed"})
    assert body["data"]["notificationsSeenAt"] == "2025-09-25T16:00:00Z"


def test_profile_without_seen_at_returns_null(aws):
    assert update(VALID)[1]["data"]["notificationsSeenAt"] is None


def test_seen_at_before_onboarding_is_404(aws):
    status, _ = update({"notificationsSeenAt": "2025-09-25T16:00:00Z"})
    assert status == 404
    assert me()[1]["data"]["profile"] is None


@pytest.mark.parametrize(
    "value",
    ["2025-09-25T16:00:00", "yesterday", "", 1758816000, "2999-01-01T00:00:00Z"],
)
def test_invalid_seen_at_is_400(aws, value):
    update(VALID)
    status, res = update({"notificationsSeenAt": value})
    assert status == 400
    assert res["error"]["detail"] == {"field": "notificationsSeenAt"}
    assert me()[1]["data"]["profile"]["notificationsSeenAt"] is None
