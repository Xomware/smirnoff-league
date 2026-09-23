"""
POST /admin/writeup-presign - a presigned S3 POST for a write-up PDF, and its pending media row. Admins only.

Body: { "week": int 1..17, "title": str (<= 120 chars) }

The upload lands at writeups/{uuid}/source.pdf, whose ObjectCreated event
starts writeup_render.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from lambdas.common import media_dynamo as media
from lambdas.common.admins import require_admin
from lambdas.common.api import ValidationError, api_handler, body, caller_sub, ok, text, whole

MAX_BYTES = 30 * 1024 * 1024
MAX_TITLE = 120
EXPIRES_SECONDS = 15 * 60
CONTENT_TYPE = "application/pdf"


@api_handler("admin_writeup_presign")
def handler(event, context):
    require_admin(event)
    data = body(event)
    week = whole(data, "week", 1, 17)
    title = text(data, "title")
    if len(title) > MAX_TITLE:
        raise ValidationError(f"title must be at most {MAX_TITLE} characters", field="title")

    writeup_id = str(uuid.uuid4())
    key = f"writeups/{writeup_id}/source.pdf"
    media_id = f"W{week:02d}#{writeup_id}"

    upload = media.s3().generate_presigned_post(
        Bucket=media.bucket(),
        Key=key,
        Fields={"Content-Type": CONTENT_TYPE},
        Conditions=[["content-length-range", 1, MAX_BYTES], {"Content-Type": CONTENT_TYPE}],
        ExpiresIn=EXPIRES_SECONDS,
    )
    media.put_writeup(
        media_id,
        {
            "week": week,
            "title": title,
            "pdfKey": key,
            "uploaderSub": caller_sub(event),
            "createdAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        },
    )
    return ok({"mediaId": media_id, "url": upload["url"], "fields": upload["fields"]})
