"""
GET /videos/list - ready ice videos, newest first, each with a 1-hour presigned GET.

Query: ?week=1..17 (optional)
"""

from __future__ import annotations

from lambdas.common import media_dynamo as media
from lambdas.common.api import ValidationError, api_handler, caller_sub, ok, query
from lambdas.common.users_dynamo import get_profile

URL_SECONDS = 60 * 60


@api_handler("videos_list")
def handler(event, context):
    caller_sub(event)

    week = query(event).get("week")
    if week is not None:
        if not week.isdigit() or not 1 <= int(week) <= 17:
            raise ValidationError("week must be a whole number from 1 to 17", field="week")
        week = int(week)

    videos = sorted(media.ready_videos(week), key=lambda v: v["createdAt"], reverse=True)
    # A league has a couple dozen members, so one GetItem per distinct uploader is fine.
    profiles = {sub: get_profile(sub) or {} for sub in {v["uploaderSub"] for v in videos}}
    return ok(
        [
            {
                "mediaId": v["mediaId"],
                "iceIds": media.covered(v)[0],
                "week": int(v["mediaId"][1:3]),
                "rosterIds": media.covered(v)[1],
                "uploaderName": profiles[v["uploaderSub"]].get("name"),
                "bytes": v["bytes"],
                "createdAt": v["createdAt"],
                "url": media.s3().generate_presigned_url(
                    "get_object",
                    Params={"Bucket": media.bucket(), "Key": v["s3Key"]},
                    ExpiresIn=URL_SECONDS,
                ),
            }
            for v in videos
        ]
    )
