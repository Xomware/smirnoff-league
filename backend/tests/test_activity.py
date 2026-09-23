import json
from datetime import datetime, timedelta, timezone

import boto3
import pytest

from lambdas.activity_track.handler import handler as activity_track
from lambdas.admin_activity.handler import handler as admin_activity
from lambdas.admin_users.handler import handler as admin_users
from lambdas.common.user_agent import ua_family
from lambdas.users_me.handler import handler as users_me
from lambdas.users_update.handler import handler as users_update
from tests.conftest import ACTIVITY_TABLE, USERS_TABLE, set_admins
from tests.events import SUB, authorized_event

UTC = timezone.utc
ADMIN = "commish@example.com"
IPHONE = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
)
MAC_CHROME = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
)


def iso(delta=timedelta()):
    return (datetime.now(UTC) + delta).isoformat()


def event(kind="open", target="stats", at=None):
    return {"kind": kind, "target": target, "at": at or iso()}


def with_ua(evt, ua):
    evt["headers"]["User-Agent"] = ua
    return evt


def track(body, ua=IPHONE, **kw):
    evt = with_ua(authorized_event(path="/activity/track", method="POST", body=body, **kw), ua)
    res = activity_track(evt, None)
    return res["statusCode"], json.loads(res["body"])


def rows(table=ACTIVITY_TABLE):
    return boto3.resource("dynamodb").Table(table).scan()["Items"]


def get(handler, path, params=None, email=ADMIN):
    evt = authorized_event(path=path, email=email)
    evt["queryStringParameters"] = params
    res = handler(evt, None)
    return res["statusCode"], json.loads(res["body"])


def onboard(**kw):
    body = {"name": "Player One", "username": "player1", "rosterId": 6}
    evt = authorized_event(path="/users/update", method="POST", body=body, **kw)
    assert users_update(evt, None)["statusCode"] == 200


def me(ua=IPHONE, **kw):
    res = users_me(with_ua(authorized_event(**kw), ua), None)
    assert res["statusCode"] == 200


def user_row(sub=SUB):
    return boto3.resource("dynamodb").Table(USERS_TABLE).get_item(Key={"sub": sub})["Item"]


def test_track_stamps_identity_from_the_token(aws):
    body = {
        "events": [event("signin", "", iso()), event("open", "team:6")],
        # Ignored: identity comes from the authorizer, never the body.
        "sub": "someone-else",
        "email": "forged@example.com",
    }
    status, res = track(body)
    assert status == 200
    assert res["data"] == {"recorded": 2}

    stored = rows()
    assert {r["sub"] for r in stored} == {SUB}
    assert {r["email"] for r in stored} == {"player@example.com"}
    assert {r["ua"] for r in stored} == {"iPhone Safari"}
    assert sorted(r["kind"] for r in stored) == ["open", "signin"]
    expires = int(stored[0]["expiresAt"])
    ninety_days = int((datetime.now(UTC) + timedelta(days=90)).timestamp())
    assert abs(expires - ninety_days) < 60
    # The SK is the UTC time then a random suffix, so it sorts by time.
    assert all(r["at"].split("#")[0].endswith("+00:00") for r in stored)


def test_batch_of_50_is_accepted_and_51_rejected(aws):
    assert track({"events": [event() for _ in range(50)]})[0] == 200
    assert len(rows()) == 50
    status, res = track({"events": [event() for _ in range(51)]})
    assert status == 400
    assert res["error"]["detail"]["field"] == "events"
    assert len(rows()) == 50


@pytest.mark.parametrize(
    "events, field",
    [
        (None, "events"),
        ([], "events"),
        ("open", "events"),
        (["open"], "events[0]"),
        ([event(kind="delete")], "events[0].kind"),
        ([event(), event(target="x" * 121)], "events[1].target"),
        ([event(target=6)], "events[0].target"),
        ([event(at="yesterday")], "events[0].at"),
        ([event(at="2026-09-23T12:00:00")], "events[0].at"),
        ([event(at=iso(timedelta(minutes=11)))], "events[0].at"),
        ([event(at=iso(timedelta(hours=-25)))], "events[0].at"),
        ([event(at=12)], "events[0].at"),
    ],
)
def test_track_rejects_a_bad_batch(aws, events, field):
    status, res = track({"events": events})
    assert status == 400
    assert res["error"]["detail"]["field"] == field
    assert rows() == []


def test_track_without_a_sub_is_401(aws):
    evt = authorized_event(path="/activity/track", method="POST", body={"events": [event()]})
    del evt["requestContext"]["authorizer"]["claims"]["sub"]
    assert activity_track(evt, None)["statusCode"] == 401
    assert rows() == []


@pytest.mark.parametrize(
    "ua, family",
    [
        (IPHONE, "iPhone Safari"),
        (MAC_CHROME, "Mac Chrome"),
        (IPHONE.replace("Version/18.0", "CriOS/129.0"), "iPhone Chrome"),
        ("Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/129.0 Mobile Safari/537.36", "Android Chrome"),
        ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/129.0 Safari/537.36 Edg/129.0", "Windows Edge"),
        ("Mozilla/5.0 (Windows NT 10.0; rv:130.0) Gecko/20100101 Firefox/130.0", "Windows Firefox"),
        ("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) Version/17.0 Safari/604.1", "iPad Safari"),
        ("curl/8.0", "Other"),
        ("", "Other"),
    ],
)
def test_ua_family(ua, family):
    assert ua_family({"headers": {"user-agent": ua}}) == family


def test_ua_family_without_headers():
    assert ua_family({"headers": None}) == "Other"


@pytest.mark.parametrize(
    "handler, path",
    [(admin_users, "/admin/users"), (admin_activity, "/admin/activity")],
)
def test_admin_routes_are_403_for_non_admins(aws, handler, path):
    set_admins(aws, ADMIN)
    status, res = get(handler, path, {"sub": SUB}, email="player@example.com")
    assert status == 403
    assert res["data"] is None


def test_users_me_counts_a_sign_in_per_30_minute_gap(aws):
    onboard()
    me()
    row = user_row()
    assert (row["signInCount"], row["lastUa"]) == (1, "iPhone Safari")
    first_seen = row["lastSeenAt"]

    me(ua=MAC_CHROME)
    row = user_row()
    assert row["signInCount"] == 1
    assert row["lastUa"] == "Mac Chrome"
    assert row["lastSeenAt"] >= first_seen

    table = boto3.resource("dynamodb").Table(USERS_TABLE)
    for minutes, expected in ((29, 1), (31, 2)):
        stale = (datetime.now(UTC) - timedelta(minutes=minutes)).isoformat(timespec="seconds")
        table.update_item(
            Key={"sub": SUB},
            UpdateExpression="SET lastSeenAt = :t",
            ExpressionAttributeValues={":t": stale},
        )
        me()
        assert user_row()["signInCount"] == expected


def test_users_me_before_onboarding_writes_nothing(aws):
    me()
    assert rows(USERS_TABLE) == []


def test_admin_users_lists_every_profile(aws):
    set_admins(aws, ADMIN)
    onboard()
    me()
    other = "3f1c2b9a-0000-4000-8000-000000000002"
    onboard(sub=other, email="co@example.com")

    status, res = get(admin_users, "/admin/users")
    assert status == 200
    users = {u["sub"]: u for u in res["data"]}
    assert set(users) == {SUB, other}
    seen = users[SUB]
    assert set(seen) == {
        "sub",
        "name",
        "username",
        "emailAddress",
        "rosterId",
        "createdAt",
        "lastSeenAt",
        "signInCount",
        "lastUa",
        "emailOptIn",
    }
    assert (seen["rosterId"], seen["signInCount"], seen["lastUa"], seen["emailOptIn"]) == (
        6,
        1,
        "iPhone Safari",
        False,
    )
    assert seen["emailAddress"] == "player@example.com"
    # Onboarded but never opened the app since: nothing seen yet.
    assert (users[other]["lastSeenAt"], users[other]["signInCount"]) == (None, 0)


@pytest.mark.parametrize("params", [None, {}, {"sub": SUB, "limit": "0"}, {"sub": SUB, "limit": "201"}, {"sub": SUB, "limit": "ten"}])
def test_admin_activity_rejects_bad_params(aws, params):
    set_admins(aws, ADMIN)
    assert get(admin_activity, "/admin/activity", params)[0] == 400


def test_scenario_sign_in_then_ice_stats_then_a_team(aws):
    set_admins(aws, ADMIN)
    onboard()
    me()
    base = (datetime.now(UTC) - timedelta(seconds=3)).replace(microsecond=0)
    steps = [("signin", ""), ("open", "stats"), ("open", "team:6")]
    batch = [event(k, t, (base + timedelta(seconds=i)).isoformat()) for i, (k, t) in enumerate(steps)]
    assert track({"events": batch})[0] == 200
    track({"events": [event("open", "news")]}, sub="3f1c2b9a-0000-4000-8000-000000000002")

    _, users = get(admin_users, "/admin/users")
    [player] = [u for u in users["data"] if u["sub"] == SUB]
    seen = datetime.fromisoformat(player["lastSeenAt"])
    assert datetime.now(UTC) - seen < timedelta(minutes=1)

    status, res = get(admin_activity, "/admin/activity", {"sub": SUB})
    assert status == 200
    assert [(e["kind"], e["target"]) for e in res["data"]] == list(reversed(steps))
    newest = res["data"][0]
    assert set(newest) == {"at", "kind", "target", "ua"}
    assert datetime.fromisoformat(newest["at"]) == base + timedelta(seconds=2)

    _, limited = get(admin_activity, "/admin/activity", {"sub": SUB, "limit": "2"})
    assert [e["target"] for e in limited["data"]] == ["team:6", "stats"]
