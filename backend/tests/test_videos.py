import base64
import json
import os

import boto3
import pytest
import requests

from lambdas.common import ices_dynamo as ices
from lambdas.common import media_dynamo as media
from lambdas.common.users_dynamo import save_profile
from lambdas.videos_confirm.handler import handler as confirm_handler
from lambdas.videos_list.handler import handler as list_handler
from lambdas.videos_presign.handler import handler as presign_handler
from tests.conftest import set_admins
from tests.events import SUB, authorized_event

NOW = "2026-09-21T12:00:00+00:00"
EARLIER = "2026-09-15T08:00:00+00:00"
OTHER_SUB = "3f1c2b9a-0000-4000-8000-000000000002"
OWN_ICE = "W01#R06#S4"
OTHER_ICE = "W01#R02#S5"
OWN_W2 = "W02#R06#LOWEST"
OWN_W2_ZERO = "W02#R06#S3"
THIRD_W2 = "W02#R09#S1"
VIDEO = {"iceId": OWN_ICE, "contentType": "video/mp4", "bytes": 1024}


@pytest.fixture
def league(aws):
    save_profile(SUB, "Player One", "player.one", 6)
    ices.put_ice({"id": OWN_ICE, "week": 1, "rosterId": 6, "reason": "zero"}, NOW)
    ices.put_ice({"id": OTHER_ICE, "week": 1, "rosterId": 2, "reason": "zero"}, NOW)
    ices.put_ice({"id": OWN_W2, "week": 2, "rosterId": 6, "reason": "lowest"}, NOW)
    ices.put_ice({"id": OWN_W2_ZERO, "week": 2, "rosterId": 6, "reason": "zero"}, NOW)
    ices.put_ice({"id": THIRD_W2, "week": 2, "rosterId": 9, "reason": "zero"}, NOW)
    return aws


def call(handler, path, method="POST", body=None, query=None, **kw):
    event = authorized_event(path=path, method=method, body=body, **kw)
    event["queryStringParameters"] = query
    res = handler(event, None)
    return res["statusCode"], json.loads(res["body"])


def presign(body=VIDEO, **kw):
    return call(presign_handler, "/videos/presign", body=body, **kw)


def confirm(media_id, **kw):
    return call(confirm_handler, "/videos/confirm", body={"mediaId": media_id}, **kw)


def list_videos(query=None):
    return call(list_handler, "/videos/list", method="GET", query=query)


def media_row(media_id):
    table = boto3.resource("dynamodb").Table(os.environ["MEDIA_TABLE"])
    return table.get_item(Key={"kind": "video", "mediaId": media_id})["Item"]


def put_object(key, body=b"\x00\x00\x00\x18ftypmp42"):
    boto3.client("s3").put_object(Bucket=os.environ["MEDIA_BUCKET"], Key=key, Body=body)


def test_presign_returns_capped_post_and_pending_row(league):
    status, res = presign()
    assert status == 200
    data = res["data"]
    fields = data["fields"]
    key = fields["key"]
    assert key.startswith(f"videos/{OWN_ICE}/") and key.endswith(".mp4")
    assert fields["Content-Type"] == "video/mp4"

    conditions = json.loads(base64.b64decode(fields["policy"]))["conditions"]
    assert ["content-length-range", 1, 200 * 1024 * 1024] in conditions
    assert {"key": key} in conditions
    assert {"Content-Type": "video/mp4"} in conditions

    uuid = key.rsplit("/", 1)[1].split(".")[0]
    assert data["mediaId"] == f"W01#{uuid}"
    row = media_row(data["mediaId"])
    assert row["status"] == "pending"
    assert (row["iceIds"], row["rosterIds"], row["uploaderSub"], row["s3Key"]) == ([OWN_ICE], [6], SUB, key)


def test_presign_for_another_rosters_ice_is_403(league):
    status, res = presign({**VIDEO, "iceId": OTHER_ICE})
    assert status == 403
    assert res["data"] is None


def test_admin_may_presign_for_any_roster(league):
    set_admins(league, "player@example.com")
    assert presign({**VIDEO, "iceId": OTHER_ICE})[0] == 200


def test_presign_without_a_profile_is_403(league):
    assert presign(sub=OTHER_SUB)[0] == 403


def test_presign_for_voided_ice_is_400(league):
    ices.update_ice(OWN_ICE, {"status": "voided"})
    assert presign()[0] == 400


def test_presign_for_unknown_ice_is_404(league):
    assert presign({**VIDEO, "iceId": "W09#R06#S1"})[0] == 404


@pytest.mark.parametrize(
    ("patch", "field"),
    [
        ({"contentType": "image/png"}, "contentType"),
        ({"contentType": "video/"}, "contentType"),
        ({"contentType": "video/mp4; x=../"}, "contentType"),
        ({"bytes": 0}, "bytes"),
        ({"bytes": 200 * 1024 * 1024 + 1}, "bytes"),
        ({"bytes": True}, "bytes"),
        ({"bytes": "1024"}, "bytes"),
        ({"iceId": 7}, "iceIds"),
        ({"iceIds": []}, "iceIds"),
        ({"iceIds": [OWN_ICE, OWN_ICE]}, "iceIds"),
        ({"iceIds": [f"W01#R06#S{n}" for n in range(11)]}, "iceIds"),
        ({"iceIds": OWN_ICE}, "iceIds"),
        ({"iceIds": [OWN_ICE, ""]}, "iceIds"),
    ],
)
def test_presign_rejects_bad_body(league, patch, field):
    status, res = presign({**VIDEO, **patch})
    assert status == 400
    assert res["error"]["detail"] == {"field": field}


def test_confirm_with_missing_object_is_409(league):
    _, res = presign()
    status, _ = confirm(res["data"]["mediaId"])
    assert status == 409
    assert media_row(res["data"]["mediaId"])["status"] == "pending"
    assert ices.get_ice(OWN_ICE)["status"] == "owed"


def test_confirm_completes_owed_ice(league):
    _, res = presign()
    media_id = res["data"]["mediaId"]
    put_object(res["data"]["fields"]["key"])

    status, body = confirm(media_id)
    assert status == 200
    row = media_row(media_id)
    assert row["status"] == "ready" and row["bytes"] == 12
    ice = ices.get_ice(OWN_ICE)
    assert ice["status"] == "completed"
    assert (ice["source"], ice["videoId"], ice["completedBySub"]) == ("upload", media_id, SUB)
    assert ice["completedAt"]
    assert body["data"]["ices"] == [ice]


def test_confirm_keeps_completed_ice_completed_at(league):
    ices.update_ice(OWN_ICE, {"status": "completed", "completedAt": EARLIER, "source": "admin"})
    _, res = presign()
    media_id = res["data"]["mediaId"]
    put_object(res["data"]["fields"]["key"])

    assert confirm(media_id)[0] == 200
    ice = ices.get_ice(OWN_ICE)
    assert (ice["status"], ice["completedAt"], ice["source"]) == ("completed", EARLIER, "admin")
    assert ice["videoId"] == media_id


def test_confirm_by_someone_else_is_403(league):
    _, res = presign()
    put_object(res["data"]["fields"]["key"])
    assert confirm(res["data"]["mediaId"], sub=OTHER_SUB, email="other@example.com")[0] == 403


def test_confirm_unknown_media_is_404(league):
    assert confirm("W01#nope")[0] == 404


def test_list_returns_ready_videos_with_presigned_urls(league):
    _, first = presign()
    put_object(first["data"]["fields"]["key"])
    confirm(first["data"]["mediaId"])
    presign()  # stays pending, so it is not listed

    status, res = list_videos()
    assert status == 200
    [video] = res["data"]
    assert video["mediaId"] == first["data"]["mediaId"]
    assert (video["iceIds"], video["week"], video["rosterIds"]) == ([OWN_ICE], 1, [6])
    assert video["uploaderName"] == "Player One"
    assert video["createdAt"]
    assert "X-Amz-Signature=" in video["url"] and "X-Amz-Expires=3600" in video["url"]


def test_list_filters_by_week(league):
    _, res = presign()
    put_object(res["data"]["fields"]["key"])
    confirm(res["data"]["mediaId"])

    assert len(list_videos({"week": "1"})[1]["data"]) == 1
    assert list_videos({"week": "2"})[1]["data"] == []
    assert list_videos({"week": "one"})[0] == 400


def test_scenario_presign_upload_confirm_list(league):
    _, res = presign()
    upload = res["data"]
    content = b"\x00\x00\x00\x18ftypmp42" * 64

    posted = requests.post(
        upload["url"], data=upload["fields"], files={"file": ("chug.mp4", content, "video/mp4")}
    )
    assert posted.status_code in (200, 204)

    assert confirm(upload["mediaId"])[0] == 200
    ice = ices.get_ice(OWN_ICE)
    assert (ice["status"], ice["source"], ice["videoId"]) == ("completed", "upload", upload["mediaId"])

    [video] = list_videos()[1]["data"]
    assert video["mediaId"] == upload["mediaId"]
    assert video["bytes"] == len(content)
    fetched = requests.get(video["url"])
    assert fetched.status_code == 200 and fetched.content == content


def upload(ice_ids, **kw):
    status, res = presign({**VIDEO, "iceIds": ice_ids}, **kw)
    assert status == 200, res
    put_object(res["data"]["fields"]["key"])
    return res["data"]["mediaId"]


def test_confirm_completes_every_listed_owed_ice(league):
    media_id = upload([OWN_W2, OWN_W2_ZERO])
    assert media_id.startswith("W02#")
    status, res = confirm(media_id)
    assert status == 200
    for ice_id in (OWN_W2, OWN_W2_ZERO):
        ice = ices.get_ice(ice_id)
        assert (ice["status"], ice["source"], ice["videoId"], ice["completedBySub"]) == (
            "completed",
            "upload",
            media_id,
            SUB,
        )
    assert [i["iceId"] for i in res["data"]["ices"]] == [OWN_W2, OWN_W2_ZERO]


def test_mixed_rosters_allowed_when_caller_owns_one(league):
    media_id = upload([OWN_W2, THIRD_W2])
    assert media_row(media_id)["rosterIds"] == [6, 9]
    assert confirm(media_id)[0] == 200
    other = ices.get_ice(THIRD_W2)
    assert (other["status"], other["completedBySub"], other["videoId"]) == ("completed", SUB, media_id)


def test_caller_owning_none_of_the_ices_is_403(league):
    status, res = presign({**VIDEO, "iceIds": [THIRD_W2]})
    assert status == 403
    assert res["data"] is None


def test_mixed_weeks_are_400(league):
    status, res = presign({**VIDEO, "iceIds": [OWN_ICE, OWN_W2]})
    assert status == 400
    assert res["error"]["detail"] == {"field": "iceIds"}


def test_any_voided_or_unknown_ice_rejects_the_whole_video(league):
    ices.update_ice(THIRD_W2, {"status": "voided"})
    assert presign({**VIDEO, "iceIds": [OWN_W2, THIRD_W2]})[0] == 400
    assert presign({**VIDEO, "iceIds": [OWN_W2, "W02#R09#S9"]})[0] == 404


def test_multi_confirm_keeps_an_already_completed_ice_completed_at(league):
    ices.update_ice(THIRD_W2, {"status": "completed", "completedAt": EARLIER, "source": "admin"})
    media_id = upload([OWN_W2, THIRD_W2])
    assert confirm(media_id)[0] == 200
    done = ices.get_ice(THIRD_W2)
    assert (done["completedAt"], done["source"], done["videoId"]) == (EARLIER, "admin", media_id)
    assert "completedBySub" not in done
    assert ices.get_ice(OWN_W2)["status"] == "completed"


def test_list_returns_every_ice_and_roster_a_video_covers(league):
    media_id = upload([OWN_W2, THIRD_W2])
    confirm(media_id)
    [video] = list_videos({"week": "2"})[1]["data"]
    assert (video["mediaId"], video["week"]) == (media_id, 2)
    assert (video["iceIds"], video["rosterIds"]) == ([OWN_W2, THIRD_W2], [6, 9])
    assert "iceId" not in video and "rosterId" not in video


def test_list_reads_rows_written_with_a_single_ice(league):
    media.put_pending(
        "W01#old",
        {"iceId": OWN_ICE, "rosterId": 6, "uploaderSub": SUB, "s3Key": "videos/x.mp4", "createdAt": NOW},
    )
    media.mark_ready("W01#old", 12)
    [video] = list_videos()[1]["data"]
    assert (video["iceIds"], video["rosterIds"]) == ([OWN_ICE], [6])


def test_scenario_two_teams_chug_together(league):
    """One upload covering both teams' W2 ices completes both, and each team's ledger rows point at it."""
    save_profile(OTHER_SUB, "Player Nine", "player.nine", 9)
    media_id = upload([OWN_W2, THIRD_W2])
    assert confirm(media_id)[0] == 200

    [video] = list_videos()[1]["data"]
    for ice_id in (OWN_W2, THIRD_W2):
        assert ices.get_ice(ice_id)["videoId"] == video["mediaId"]
    assert set(video["rosterIds"]) == {6, 9}
