"""
POST /admin/writeup-publish - publish or unpublish a write-up. Admins only.

Body: { "mediaId": str, "published": bool }

Only a rendered write-up can be published; anything else is 409. Publishing
mails the edition to opted-in users right away. A mail failure never fails the
publish: cron_tick sends whatever this missed on its next tick.
"""

from __future__ import annotations

from datetime import datetime, timezone

from lambdas.common import mailer
from lambdas.common import media_dynamo as media
from lambdas.common.admins import require_admin
from lambdas.common.api import ConflictError, NotFoundError, ValidationError, api_handler, body, ok, text
from lambdas.common.logger import get_logger

log = get_logger(__file__)


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

    now = datetime.now(timezone.utc)
    row = media.set_published(media_id, now.isoformat(timespec="seconds") if published else None)
    if published:
        try:
            mailer.send_edition(row, now)
        except Exception:  # noqa: BLE001 -- published either way; cron_tick retries the mail
            log.exception("admin_writeup_publish: edition mail failed for %s", media_id)
    return ok(row)
