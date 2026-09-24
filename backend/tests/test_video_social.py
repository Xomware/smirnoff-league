import json

import pytest

from lambdas.common import media_dynamo as media
from lambdas.common.users_dynamo import save_profile
from lambdas.videos_comment.handler import handler as comment_handler
from lambdas.videos_comment_delete.handler import handler as delete_handler
from lambdas.videos_react.handler import handler as react_handler
from lambdas.videos_social.handler import handler as social_handler
from lambdas.videos_social_recent.handler import handler as recent_handler
from tests.conftest import set_admins
from tests.events import SUB, authorized_event

OTHER_SUB = "3f1c2b9a-0000-4000-8000-000000000002"
STRANGER_SUB = "3f1c2b9a-0000-4000-8000-000000000003"
OTHER_EMAIL = "other@example.com"
VIDEO = "W01#11111111-1111-4111-8111-111111111111"
SHARED_VIDEO = "W02#22222222-2222-4222-8222-222222222222"
PENDING = "W01#33333333-3333-4333-8333-333333333333"
TYPES = ["glacier", "stopwatch", "bottle", "siren", "crown"]


def put_video(media_id, uploader, roster_ids, ready=True):
    media.put_pending(
        media_id,
        {
            "iceIds": [f"W01#R{r:02d}#S1" for r in roster_ids],
            "rosterIds": roster_ids,
            "uploaderSub": uploader,
            "s3Key": f"videos/x/{media_id}.mp4",
            "createdAt": "2026-09-21T12:00:00+00:00",
        },
    )
    if ready:
        media.mark_ready(media_id, 1024)


@pytest.fixture
def league(aws):
    save_profile(SUB, "Player One", "player.one", 6, "player@example.com")
    save_profile(OTHER_SUB, "Player Two", "player.two", 2, OTHER_EMAIL)
    put_video(VIDEO, SUB, [6])
    put_video(SHARED_VIDEO, OTHER_SUB, [2, 6])
    put_video(PENDING, SUB, [6], ready=False)
    return aws


def call(handler, method, body=None, query=None, sub=SUB, email="player@example.com"):
    event = authorized_event(method=method, body=body, sub=sub, email=email)
    event["queryStringParameters"] = query
    res = handler(event, None)
    return res["statusCode"], json.loads(res["body"])


def social(video=VIDEO, **kw):
    return call(social_handler, "GET", query={"videoId": video}, **kw)


def react(kind, video=VIDEO, **kw):
    return call(react_handler, "POST", body={"videoId": video, "type": kind}, **kw)


def comment(text, video=VIDEO, **kw):
    return call(comment_handler, "POST", body={"videoId": video, "text": text}, **kw)


def delete(comment_id, video=VIDEO, **kw):
    return call(delete_handler, "POST", body={"videoId": video, "commentId": comment_id}, **kw)


def recent(**kw):
    return call(recent_handler, "GET", **kw)


def as_other():
    return {"sub": OTHER_SUB, "email": OTHER_EMAIL}


def test_social_for_a_quiet_video_lists_every_reaction_at_zero(league):
    status, res = social()
    assert status == 200
    assert res["data"] == {
        "reactions": {t: {"count": 0, "mine": False, "by": []} for t in TYPES},
        "comments": [],
    }


@pytest.mark.parametrize("video", ["W09#nope", PENDING])
def test_social_for_a_missing_or_unready_video_is_404(league, video):
    assert social(video)[0] == 404


def test_social_without_video_id_is_400(league):
    assert call(social_handler, "GET", query=None)[0] == 400


def test_react_toggles_on_then_off(league):
    status, res = react("glacier")
    assert status == 200
    assert res["data"]["reactions"]["glacier"] == {"count": 1, "mine": True, "by": ["Player One"]}

    react("glacier", **as_other())
    _, res = social(**as_other())
    assert res["data"]["reactions"]["glacier"] == {"count": 2, "mine": True, "by": ["Player One", "Player Two"]}

    _, res = react("glacier")
    assert res["data"]["reactions"]["glacier"] == {"count": 1, "mine": False, "by": ["Player Two"]}


def test_reactions_of_different_types_are_independent(league):
    react("crown")
    _, res = react("siren")
    reactions = res["data"]["reactions"]
    assert reactions["crown"]["mine"] and reactions["siren"]["mine"]
    assert reactions["bottle"]["count"] == 0


@pytest.mark.parametrize("kind", ["heart", "", None, 3])
def test_react_with_an_unknown_type_is_400(league, kind):
    assert react(kind)[0] == 400


def test_react_on_a_pending_video_is_404(league):
    assert react("glacier", PENDING)[0] == 404


def test_react_without_a_profile_is_403(league):
    assert react("glacier", sub=STRANGER_SUB)[0] == 403


def test_comment_is_trimmed_attributed_and_leaks_no_email(league):
    status, res = comment("  cold one  ", **as_other())
    assert status == 200
    [c] = res["data"]["comments"]
    assert c["text"] == "cold one"
    assert c["author"] == {"rosterId": 2, "displayName": "Player Two"}
    assert c["mine"] is True
    assert c["id"] and c["createdAt"]

    _, res = social()
    assert res["data"]["comments"][0]["mine"] is False
    assert "@" not in json.dumps(res)


def test_comments_come_back_oldest_first(league):
    for text in ("one", "two", "three"):
        comment(text)
    _, res = social()
    assert [c["text"] for c in res["data"]["comments"]] == ["one", "two", "three"]


def test_comment_at_280_chars_after_trimming_is_accepted(league):
    assert comment("  " + "x" * 280 + "  ")[0] == 200


@pytest.mark.parametrize("text", ["x" * 281, "   ", "", None, 5])
def test_comment_that_is_blank_or_too_long_is_400(league, text):
    assert comment(text)[0] == 400


def test_comment_on_an_unknown_video_is_404(league):
    assert comment("hi", "W09#nope")[0] == 404


def test_comment_without_a_profile_is_403(league):
    assert comment("hi", sub=STRANGER_SUB)[0] == 403


def test_eleventh_comment_in_a_minute_is_429(league):
    for i in range(10):
        assert comment(f"c{i}")[0] == 200
    status, res = comment("one too many")
    assert status == 429
    assert res["error"]["message"]
    assert comment("from someone else", **as_other())[0] == 200


def test_author_deletes_own_comment(league):
    _, res = comment("oops")
    comment_id = res["data"]["comments"][0]["id"]
    status, res = delete(comment_id)
    assert status == 200
    assert res["data"]["comments"] == []


def test_deleting_someone_elses_comment_is_403(league):
    _, res = comment("mine", **as_other())
    assert delete(res["data"]["comments"][0]["id"])[0] == 403


def test_admin_deletes_any_comment(league):
    set_admins(league, "player@example.com")
    _, res = comment("rude", **as_other())
    status, res = delete(res["data"]["comments"][0]["id"])
    assert status == 200
    assert res["data"]["comments"] == []


def test_deleting_an_unknown_comment_is_404(league):
    assert delete("nope")[0] == 404


def test_recent_lists_others_comments_on_videos_i_chugged_in(league):
    comment("my own", VIDEO)
    comment("nice chug", VIDEO, **as_other())
    comment("we both chugged", SHARED_VIDEO, **as_other())
    comment("not mine to see", PENDING, **as_other())

    status, res = recent()
    assert status == 200
    items = res["data"]
    assert [i["text"] for i in items] == ["we both chugged", "nice chug"]
    assert items[0]["videoId"] == SHARED_VIDEO
    assert items[0]["week"] == 2
    assert items[0]["author"] == {"rosterId": 2, "displayName": "Player Two"}
    assert "@" not in json.dumps(res)


def test_recent_includes_videos_i_uploaded_for_others(league):
    put_video("W03#44444444-4444-4444-8444-444444444444", SUB, [2])
    comment("thanks for filming", "W03#44444444-4444-4444-8444-444444444444", **as_other())
    _, res = recent()
    assert [i["text"] for i in res["data"]] == ["thanks for filming"]


def test_recent_without_a_profile_is_403(league):
    assert recent(sub=STRANGER_SUB)[0] == 403
