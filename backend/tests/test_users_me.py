import json

from lambdas.users_me.handler import handler
from tests.events import authorized_event


def test_returns_caller_identity_from_authorizer_claims():
    res = handler(authorized_event(), None)
    assert res["statusCode"] == 200
    assert json.loads(res["body"]) == {
        "data": {
            "sub": "3f1c2b9a-0000-4000-8000-000000000001",
            "email": "player@example.com",
            "profile": None,
            "isAdmin": False,
        },
        "error": None,
        "meta": None,
    }


def test_missing_sub_is_401():
    event = authorized_event()
    del event["requestContext"]["authorizer"]["claims"]["sub"]
    res = handler(event, None)
    assert res["statusCode"] == 401
    assert json.loads(res["body"])["data"] is None
