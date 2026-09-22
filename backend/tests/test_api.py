import json

import pytest

from lambdas.common.api import NotFoundError, api_handler, ok
from tests.events import authorized_event


@pytest.fixture(autouse=True)
def origins(monkeypatch):
    monkeypatch.setenv("CORS_ALLOW_ORIGIN", "https://smirnoff.xomware.com,http://localhost:3000")


def call(fn, event=None):
    res = api_handler("test")(fn)(event or authorized_event(), None)
    return res, json.loads(res["body"])


def test_ok_wraps_body_in_envelope():
    res, body = call(lambda e, c: ok({"x": 1}))
    assert res["statusCode"] == 200
    assert body == {"data": {"x": 1}, "error": None, "meta": None}


def test_ok_carries_meta():
    _, body = call(lambda e, c: ok([1, 2], meta={"count": 2}))
    assert body == {"data": [1, 2], "error": None, "meta": {"count": 2}}


def test_api_error_uses_its_status_and_envelope():
    def fn(e, c):
        raise NotFoundError("No such ice")

    res, body = call(fn)
    assert res["statusCode"] == 404
    assert body == {
        "data": None,
        "error": {"handler": "test", "message": "No such ice"},
        "meta": None,
    }


def test_unexpected_error_is_a_500_without_detail():
    def fn(e, c):
        raise KeyError("smirnoff-users")

    res, body = call(fn)
    assert res["statusCode"] == 500
    assert body == {
        "data": None,
        "error": {"handler": "test", "message": "Internal error"},
        "meta": None,
    }


def test_echoes_an_allowed_origin():
    res, _ = call(lambda e, c: ok(None), authorized_event(origin="http://localhost:3000"))
    assert res["headers"]["Access-Control-Allow-Origin"] == "http://localhost:3000"


def test_unknown_origin_gets_the_primary_one():
    res, _ = call(lambda e, c: ok(None), authorized_event(origin="https://evil.example"))
    assert res["headers"]["Access-Control-Allow-Origin"] == "https://smirnoff.xomware.com"
