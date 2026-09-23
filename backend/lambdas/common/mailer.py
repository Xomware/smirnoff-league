"""
Alert emails: find each opted-in user's events, claim each in a sent log, send it through SES v2.

Only events from the last RECENT window count, so the first run after a deploy
does not mail the season's history. The sent log is MAIL#<sub>#<eventId> rows in
smirnoff-settings, and the conditional put is the claim, so overlapping runs
cannot both send. A failed send flips its row to `failed`, which the next run
may claim again. A crash between claim and send loses that one email rather
than risking a double.
"""

from __future__ import annotations

import functools
import os
from collections import Counter
from collections.abc import Iterator
from datetime import datetime, timedelta
from email.message import EmailMessage
from email.utils import formataddr

import boto3
from botocore.exceptions import ClientError

from lambdas.common import ices_dynamo as ices
from lambdas.common import media_dynamo as media
from lambdas.common.dynamo import table
from lambdas.common.email_templates import render
from lambdas.common.late import week_deadlines
from lambdas.common.logger import get_logger
from lambdas.common.unsubscribe import make_token
from lambdas.common.users_dynamo import list_profiles

log = get_logger(__file__)

RECENT = timedelta(days=2)
# Tightest first: a run inside 6h sends only the 6h reminder.
DUE = (("due6h", timedelta(hours=6)), ("due48h", timedelta(hours=48)))


@functools.cache
def _param(name: str) -> str:
    ssm = boto3.client("ssm", region_name=os.environ.get("AWS_REGION", "us-east-1"))
    return ssm.get_parameter(Name=f"/{os.environ['APP_NAME']}/{name}")["Parameter"]["Value"]


@functools.cache
def _ses():
    return boto3.client("sesv2", region_name=os.environ.get("AWS_REGION", "us-east-1"))


def _site() -> str:
    # The first CORS origin is the site; locals.tf puts the domain there.
    return os.environ["CORS_ALLOW_ORIGIN"].split(",")[0]


def _log_key(sub: str, event_id: str) -> dict:
    return {"season": ices.SEASON, "key": f"MAIL#{sub}#{event_id}"}


def claim(sub: str, event_id: str, now: datetime) -> bool:
    try:
        table("SETTINGS_TABLE").put_item(
            Item={**_log_key(sub, event_id), "status": "sent", "at": now.isoformat(timespec="seconds")},
            ConditionExpression="attribute_not_exists(#key) OR #status = :failed",
            ExpressionAttributeNames={"#key": "key", "#status": "status"},
            ExpressionAttributeValues={":failed": "failed"},
        )
    except ClientError as e:
        if e.response["Error"]["Code"] != "ConditionalCheckFailedException":
            raise
        return False
    return True


def _release(sub: str, event_id: str) -> None:
    table("SETTINGS_TABLE").update_item(
        Key=_log_key(sub, event_id),
        UpdateExpression="SET #status = :failed",
        ExpressionAttributeNames={"#status": "status"},
        ExpressionAttributeValues={":failed": "failed"},
    )


def _deliver(user: dict, kind: str, event_id: str, ctx: dict, now: datetime) -> str | None:
    """'sent' or 'failed', or None when the user turned this type off or it already went."""
    sub = user["sub"]
    if not user["email"]["types"][kind]:
        return None
    api = _param("api-url")
    unsub = {k: f"{api}/email/unsubscribe?token={make_token(sub, k)}" for k in (kind, "all")}
    subject, html, text = render(kind, ctx, _site(), unsub[kind], unsub["all"])
    if not claim(sub, event_id, now):
        return None

    msg = EmailMessage()
    msg["From"] = formataddr(("Smirnoff League", _param("email-sender")))
    msg["To"] = user["emailAddress"]
    msg["Subject"] = subject
    # Mail clients show the header as "unsubscribe from this sender", so it turns off everything.
    msg["List-Unsubscribe"] = f"<{unsub['all']}>"
    msg["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"
    msg.set_content(text)
    msg.add_alternative(html, subtype="html")
    try:
        _ses().send_email(
            Content={"Raw": {"Data": msg.as_bytes()}}, ConfigurationSetName=_param("email-config-set")
        )
    except ClientError as e:
        log.error("mail %s to %s failed, retrying next tick: %s", event_id, sub, e.response["Error"]["Code"])
        _release(sub, event_id)
        return "failed"
    return "sent"


def _recipients() -> list[dict]:
    return [u for u in list_profiles() if u["email"]["optIn"] and u.get("emailAddress")]


def _events(
    user: dict,
    now: datetime,
    since: str,
    rows: list[dict],
    deadlines: dict[int, datetime],
    videos: list[dict],
    editions: list[dict],
) -> Iterator[tuple[str, str, dict]]:
    mine = [i for i in rows if i["rosterId"] == user["rosterId"] and i["status"] != "voided"]
    original = [i for i in mine if i["source"] == "cron" and i["reason"] in ices.COMPUTED_REASONS]

    for week in sorted({i["week"] for i in original if i["createdAt"] >= since}):
        count = sum(i["week"] == week for i in original)
        yield "iced", f"iced#W{week:02d}", {"week": week, "count": count}

    # Only computed ices go late, so only they have a deadline to remind about.
    for week, deadline in deadlines.items():
        owed = sum(i["week"] == week and i["status"] == "owed" for i in original)
        kind = next((k for k, window in DUE if timedelta(0) < deadline - now <= window), None)
        if owed and kind:
            yield kind, f"{kind}#W{week:02d}", {"week": week, "count": owed, "deadline": deadline}

    for i in mine:
        if i["reason"] == "late" and i["status"] == "owed" and i["createdAt"] >= since:
            yield "lateAdded", f"lateAdded#{i['iceId']}", {"week": i["week"]}

    my_ids = {i["iceId"] for i in mine}
    for v in videos:
        if v["uploaderSub"] != user["sub"] and my_ids & set(media.covered(v)[0]):
            yield "videoOfMine", f"videoOfMine#{v['mediaId']}", {"week": int(v["mediaId"][1:3])}

    for w in editions:
        yield "edition", f"edition#{w['mediaId']}", {"week": w["week"], "title": w["title"]}


def _summary(counts: Counter) -> dict:
    log.info("mail: %d sent, %d failed", counts["sent"], counts["failed"])
    return {"sent": counts["sent"], "failed": counts["failed"]}


def run(now: datetime) -> dict:
    """Every due alert for every opted-in user. Safe to run as often as the cron ticks."""
    users = _recipients()
    counts: Counter = Counter()
    if not users:
        return _summary(counts)

    since = (now - RECENT).isoformat(timespec="seconds")
    rows = ices.season_ices()
    deadlines = week_deadlines()
    videos = [v for v in media.ready_videos() if v["createdAt"] >= since]
    editions = [w for w in media.published_writeups() if w["publishedAt"] >= since]
    for user in users:
        for kind, event_id, ctx in _events(user, now, since, rows, deadlines, videos, editions):
            counts[_deliver(user, kind, event_id, ctx, now)] += 1
    return _summary(counts)


def send_edition(writeup: dict, now: datetime) -> dict:
    event_id = f"edition#{writeup['mediaId']}"
    ctx = {"week": writeup["week"], "title": writeup["title"]}
    counts = Counter(_deliver(user, "edition", event_id, ctx, now) for user in _recipients())
    return _summary(counts)
