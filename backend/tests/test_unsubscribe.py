import base64
import json
import re
from pathlib import Path
from urllib.parse import urlencode

import pytest

from lambdas.common.unsubscribe import make_token, verify
from lambdas.email_unsubscribe.handler import handler as unsubscribe
from lambdas.users_me.handler import handler as users_me
from lambdas.users_update.handler import handler as users_update
from tests.events import SUB, authorized_event

VALID = {"name": "Player One", "username": "player.one_1", "rosterId": 7}
ALL_ON = {t: True for t in ("iced", "due48h", "due6h", "lateAdded", "edition", "videoOfMine")}
TERRAFORM = Path(__file__).resolve().parents[2] / "infrastructure" / "terraform"


def public_event(token, method="GET", body=None):
    """What API Gateway delivers on a route with authorization NONE: no authorizer claims."""
    return {
        "resource": "/email/unsubscribe",
        "path": "/email/unsubscribe",
        "httpMethod": method,
        "headers": {"content-type": "application/x-www-form-urlencoded"} if body else {},
        "queryStringParameters": None if token is None else {"token": token},
        "body": body,
        "isBase64Encoded": False,
        "requestContext": {"resourcePath": "/email/unsubscribe", "httpMethod": method, "stage": "dev"},
    }


def update(body):
    res = users_update(authorized_event(path="/users/update", method="POST", body=body), None)
    return json.loads(res["body"])["data"]


def prefs():
    return json.loads(users_me(authorized_event(), None)["body"])["data"]["profile"]["email"]


@pytest.fixture
def opted_in(aws):
    update(VALID)
    update({"email": {"optIn": True, "types": ALL_ON}})


def test_token_round_trips_and_is_url_safe(aws):
    for kind in ("due6h", "all"):
        token = make_token(SUB, kind)
        assert re.fullmatch(r"[A-Za-z0-9_\-.]+", token)
        assert verify(token) == (SUB, kind)


def test_unknown_type_cannot_be_signed(aws):
    with pytest.raises(ValueError):
        make_token(SUB, "sms")


@pytest.mark.parametrize(
    "tamper",
    [
        lambda t: t[:-2] + ("AA" if t[-2:] != "AA" else "BB"),
        lambda t: make_token("someone-else", "all").split(".")[0] + "." + t.split(".")[1],
        lambda t: t.split(".")[0],
        lambda t: "",
        lambda t: "not a token",
        lambda t: t + ".extra",
    ],
)
def test_tampered_token_is_rejected(aws, tamper):
    assert verify(tamper(make_token(SUB, "iced"))) is None


def test_get_confirms_without_changing_anything(opted_in):
    token = make_token(SUB, "due48h")
    res = unsubscribe(public_event(token), None)
    assert res["statusCode"] == 200
    assert res["headers"]["Content-Type"].startswith("text/html")
    assert "Unsubscribe from &ldquo;48 hours before an ice is due&rdquo; emails?" in res["body"]
    assert '<form method="post">' in res["body"]
    assert f'name="token" value="{token}"' in res["body"]
    assert "smirnoff-league.com" in res["body"]
    assert prefs() == {"optIn": True, "types": ALL_ON}


def test_form_post_flips_one_type(opted_in):
    res = unsubscribe(public_event(None, "POST", urlencode({"token": make_token(SUB, "due48h")})), None)
    assert res["statusCode"] == 200
    assert "unsubscribed from &ldquo;48 hours before an ice is due&rdquo; emails" in res["body"]
    assert prefs() == {"optIn": True, "types": {**ALL_ON, "due48h": False}}


def test_form_post_reads_a_base64_body(opted_in):
    event = public_event(None, "POST", base64.b64encode(urlencode({"token": make_token(SUB, "iced")}).encode()).decode())
    event["isBase64Encoded"] = True
    assert unsubscribe(event, None)["statusCode"] == 200
    assert prefs()["types"]["iced"] is False


def test_one_click_post_flips_all(opted_in):
    res = unsubscribe(public_event(make_token(SUB, "all"), "POST", "List-Unsubscribe=One-Click"), None)
    assert res["statusCode"] == 200
    assert prefs() == {"optIn": False, "types": ALL_ON}


@pytest.mark.parametrize("method", ["GET", "POST"])
def test_tampered_token_gets_a_400_page_and_changes_nothing(opted_in, method):
    token = make_token(SUB, "all")
    res = unsubscribe(public_event(token[:-4] + "AAAA", method), None)
    assert res["statusCode"] == 400
    assert res["headers"]["Content-Type"].startswith("text/html")
    assert prefs()["optIn"] is True


def test_missing_token_is_a_400_page(aws):
    res = unsubscribe(public_event(None), None)
    assert res["statusCode"] == 400
    assert res["headers"]["Content-Type"].startswith("text/html")


def test_other_methods_are_405(opted_in):
    res = unsubscribe(public_event(make_token(SUB, "all"), "DELETE"), None)
    assert res["statusCode"] == 405
    assert prefs()["optIn"] is True


def test_unsubscribe_is_the_only_route_without_auth():
    routes = re.findall(r'path_part = "([^"]+)".*?authorization = "([^"]+)"', (TERRAFORM / "lambda.tf").read_text())
    assert routes
    assert [p for p, auth in routes if auth != "COGNITO_USER_POOLS"] == ["unsubscribe"]
    assert dict(routes)["unsubscribe"] == "NONE"


def test_scenario_opt_in_turn_off_6h_then_unsubscribe_all(aws):
    update(VALID)
    update({"email": {"optIn": True, "types": ALL_ON}})
    update({"email": {"optIn": True, "types": {**ALL_ON, "due6h": False}}})
    assert prefs() == {"optIn": True, "types": {**ALL_ON, "due6h": False}}

    link = make_token(SUB, "all")
    page = unsubscribe(public_event(link), None)
    assert "Unsubscribe from all Smirnoff League emails?" in page["body"]
    assert prefs()["optIn"] is True

    # The page's form posts back to the same URL, token in the query and the body.
    res = unsubscribe(public_event(link, "POST", urlencode({"token": link})), None)
    assert res["statusCode"] == 200
    assert "unsubscribed from all Smirnoff League emails" in res["body"]
    assert prefs() == {"optIn": False, "types": {**ALL_ON, "due6h": False}}
