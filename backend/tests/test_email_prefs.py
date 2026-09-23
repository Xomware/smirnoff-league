import json

import pytest

from lambdas.users_me.handler import handler as users_me
from lambdas.users_update.handler import handler as users_update
from tests.events import authorized_event

VALID = {"name": "Player One", "username": "player.one_1", "rosterId": 7}
TYPES = ("iced", "due48h", "due6h", "lateAdded", "edition", "videoOfMine")
ALL_ON = {t: True for t in TYPES}


def update(body, **kw):
    res = users_update(authorized_event(path="/users/update", method="POST", body=body, **kw), None)
    return res["statusCode"], json.loads(res["body"])


def me(**kw):
    res = users_me(authorized_event(**kw), None)
    return res["statusCode"], json.loads(res["body"])


def test_new_profile_defaults_to_opted_out_with_every_type_on(aws):
    _, body = update(VALID)
    assert body["data"]["email"] == {"optIn": False, "types": ALL_ON}


def test_email_patch_saves_on_its_own_and_keeps_the_profile(aws):
    update(VALID)
    prefs = {"optIn": True, "types": {**ALL_ON, "due6h": False}}
    status, body = update({"email": prefs})
    assert status == 200
    assert body["data"]["email"] == prefs
    assert body["data"]["username"] == VALID["username"]
    assert me()[1]["data"]["profile"]["email"] == prefs


def test_profile_update_keeps_email_prefs(aws):
    update(VALID)
    prefs = {"optIn": True, "types": {**ALL_ON, "edition": False}}
    update({"email": prefs})
    _, body = update({**VALID, "name": "Renamed"})
    assert body["data"]["email"] == prefs


def test_email_patch_before_onboarding_is_404(aws):
    status, _ = update({"email": {"optIn": True, "types": ALL_ON}})
    assert status == 404
    assert me()[1]["data"]["profile"] is None


@pytest.mark.parametrize(
    "email",
    [
        None,
        True,
        "yes",
        {},
        {"optIn": True},
        {"types": ALL_ON},
        {"optIn": "true", "types": ALL_ON},
        {"optIn": 1, "types": ALL_ON},
        {"optIn": True, "types": {**ALL_ON, "due6h": 0}},
        {"optIn": True, "types": {k: v for k, v in ALL_ON.items() if k != "iced"}},
        {"optIn": True, "types": {**ALL_ON, "sms": True}},
        {"optIn": True, "types": ALL_ON, "address": "else@example.com"},
        {"optIn": True, "types": [True] * 6},
    ],
)
def test_invalid_email_prefs_are_400(aws, email):
    update(VALID)
    status, res = update({"email": email})
    assert status == 400
    assert res["error"]["detail"] == {"field": "email"}
    assert me()[1]["data"]["profile"]["email"]["optIn"] is False


def test_email_patch_rides_alone(aws):
    update(VALID)
    status, res = update({**VALID, "email": {"optIn": True, "types": ALL_ON}})
    assert status == 400
    assert res["error"]["detail"] == {"field": "email"}


def test_address_comes_from_the_token_on_every_call(aws):
    _, body = update(VALID, email="First@Example.com")
    assert body["data"]["emailAddress"] == "first@example.com"

    _, body = me(email="Moved@Example.com")
    assert body["data"]["profile"]["emailAddress"] == "moved@example.com"

    _, body = update({"email": {"optIn": True, "types": ALL_ON}}, email="third@example.com")
    assert body["data"]["emailAddress"] == "third@example.com"


def test_me_before_onboarding_stores_nothing(aws):
    _, body = me()
    assert body["data"]["profile"] is None
    assert me()[1]["data"]["profile"] is None
