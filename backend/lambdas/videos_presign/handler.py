"""
POST /videos/presign - a presigned S3 POST for one ice video, and its pending media row.

Body: { "iceIds": [str] 1..10 unique, "contentType": "video/*", "bytes": int 1..200 MB }
A lone "iceId": str is read as a one-item iceIds.

One video can cover several ices, across rosters when teams chug together, so
every ice must share a week, and the caller's profile rosterId must own at
least one of them unless the caller is an admin.
A presigned POST rather than PUT because only a POST policy can carry
content-length-range, so S3 itself enforces the size cap whatever the client
declared in `bytes`.
"""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone

from lambdas.common import media_dynamo as media
from lambdas.common.admins import is_admin
from lambdas.common.api import (
    ForbiddenError,
    NotFoundError,
    ValidationError,
    api_handler,
    body,
    caller_email,
    caller_sub,
    ok,
)
from lambdas.common.ices_dynamo import get_ice
from lambdas.common.users_dynamo import get_profile

MAX_ICES = 10
MAX_BYTES = 200 * 1024 * 1024
EXPIRES_SECONDS = 15 * 60
CONTENT_TYPE = re.compile(r"video/[A-Za-z0-9][A-Za-z0-9.+-]{0,63}")
EXTENSIONS = {"quicktime": "mov", "x-matroska": "mkv", "x-msvideo": "avi"}


@api_handler("videos_presign")
def handler(event, context):
    sub = caller_sub(event)
    data = body(event)

    ice_ids = data["iceIds"] if "iceIds" in data else [data.get("iceId")]
    if (
        not isinstance(ice_ids, list)
        or not 1 <= len(ice_ids) <= MAX_ICES
        or not all(isinstance(i, str) and i.strip() for i in ice_ids)
        or len(set(ice_ids)) != len(ice_ids)
    ):
        raise ValidationError(f"iceIds must be 1 to {MAX_ICES} distinct ice ids", field="iceIds")

    content_type = data.get("contentType")
    if not isinstance(content_type, str) or not CONTENT_TYPE.fullmatch(content_type):
        raise ValidationError("contentType must be a video/* type", field="contentType")

    size = data.get("bytes")
    # bool is an int subclass, so True would otherwise pass as 1 byte.
    if type(size) is not int or not 1 <= size <= MAX_BYTES:
        raise ValidationError("bytes must be a whole number from 1 to 200 MB", field="bytes")

    listed = [get_ice(i) for i in ice_ids]
    if None in listed:
        raise NotFoundError("Ice not found")
    roster_ids = list(dict.fromkeys(i["rosterId"] for i in listed))

    profile = get_profile(sub) or {}
    if profile.get("rosterId") not in roster_ids and not is_admin(caller_email(event)):
        raise ForbiddenError("None of those ices belong to your roster")

    if any(i["status"] == "voided" for i in listed):
        raise ValidationError("That ice was voided", field="iceIds")
    weeks = {i["week"] for i in listed}
    if len(weeks) > 1:
        raise ValidationError("One video covers one week's ices", field="iceIds")

    video_id = str(uuid.uuid4())
    subtype = content_type.split("/", 1)[1].lower()
    key = f"videos/{ice_ids[0]}/{video_id}.{EXTENSIONS.get(subtype, subtype)}"
    media_id = f"W{weeks.pop():02d}#{video_id}"

    upload = media.s3().generate_presigned_post(
        Bucket=media.bucket(),
        Key=key,
        Fields={"Content-Type": content_type},
        Conditions=[["content-length-range", 1, MAX_BYTES], {"Content-Type": content_type}],
        ExpiresIn=EXPIRES_SECONDS,
    )
    media.put_pending(
        media_id,
        {
            "iceIds": ice_ids,
            "rosterIds": roster_ids,
            "uploaderSub": sub,
            "s3Key": key,
            "createdAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        },
    )
    return ok({"mediaId": media_id, "url": upload["url"], "fields": upload["fields"]})
