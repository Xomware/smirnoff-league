"""
POST /admin/writeup-publish - publish or unpublish a write-up. Admins only.

Body: { "mediaId": str, "published": bool }

Only a rendered write-up can be published; anything else is 409.
"""

from __future__ import annotations

from datetime import datetime, timezone

from lambdas.common import media_dynamo as media
from lambdas.common.admins import require_admin
from lambdas.common.api import ConflictError, NotFoundError, ValidationError, api_handler, body, ok, text


@api_handler("admin_writeup_publish")
def handler(event, context):
    require_admin(event)
    data = body(event)
    media_id = text(data, "mediaId")
    published = data.get("published")
    if type(published) is not bool:
        raise ValidationError("published must be true or false", field="published")

    writeup = media.get_writeup(media_id)
    if writeup is None:
        raise NotFoundError("Write-up not found")
    if published and writeup["status"] != "rendered":
        raise ConflictError(f"Write-up is {writeup['status']}, not rendered")

    at = datetime.now(timezone.utc).isoformat(timespec="seconds") if published else None
    return ok(media.set_published(media_id, at))
