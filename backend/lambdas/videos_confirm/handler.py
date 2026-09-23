"""
POST /videos/confirm - mark an uploaded video ready and settle every ice it covers.

Body: { "mediaId": "W{ww}#{uuid}" }

Only the uploader or an admin may confirm. Each owed ice becomes completed with
source `upload` and completedBySub the uploader, other rosters' ices chugged in
the same video included; an already-completed ice keeps its completedAt and
source and only gains the videoId. A voided or deleted ice is left alone.
"""

from __future__ import annotations

from datetime import datetime, timezone

from botocore.exceptions import ClientError

from lambdas.common import ices_dynamo as ices
from lambdas.common import media_dynamo as media
from lambdas.common.admins import is_admin
from lambdas.common.api import (
    ConflictError,
    ForbiddenError,
    NotFoundError,
    api_handler,
    body,
    caller_email,
    caller_sub,
    ok,
    require,
)


@api_handler("videos_confirm")
def handler(event, context):
    sub = caller_sub(event)
    (media_id,) = require(body(event), "mediaId")

    video = media.get_video(media_id)
    if video is None:
        raise NotFoundError("Video not found")
    if video["uploaderSub"] != sub and not is_admin(caller_email(event)):
        raise ForbiddenError("Only the uploader can confirm this video")

    try:
        head = media.s3().head_object(Bucket=media.bucket(), Key=video["s3Key"])
    except ClientError as e:
        if e.response["Error"]["Code"] not in ("404", "NoSuchKey"):
            raise
        raise ConflictError("The upload has not landed in S3") from e

    media.mark_ready(media_id, head["ContentLength"])

    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    settled = []
    for ice_id in media.covered(video)[0]:
        ice = ices.get_ice(ice_id)
        if ice is None or ice["status"] == "voided":
            continue
        fields = {"videoId": media_id}
        if ice["status"] == "owed":
            fields |= {"status": "completed", "completedAt": now, "completedBySub": sub, "source": "upload"}
        settled.append(ices.update_ice(ice_id, fields))

    return ok({"video": media.get_video(media_id), "ices": settled})
