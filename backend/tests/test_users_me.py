import json

from lambdas.users_me.handler import handler
from tests.conftest import set_admins
from tests.events import SUB, authorized_event


def test_first_call_has_no_profile(aws):
    res = handler(authorized_event(), None)
    assert res["statusCode"] == 200
    assert json.loads(res["body"]) == {
        "data": {
            "sub": SUB,
            "email": "player@example.com",
            "profile": None,
            "isAdmin": False,
        },
        "error": None,
        "meta": None,
    }


def test_listed_email_is_admin(aws):
    set_admins(aws, "PLAYER@example.com")
    res = handler(authorized_event(), None)
    assert json.loads(res["body"])["data"]["isAdmin"] is True


def test_missing_sub_is_401():
    event = authorized_event()
    del event["requestContext"]["authorizer"]["claims"]["sub"]
    res = handler(event, None)
    assert res["statusCode"] == 401
    assert json.loads(res["body"])["data"] is None
