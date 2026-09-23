import email
import os
from datetime import datetime, timedelta, timezone
from email import policy
from urllib.parse import parse_qs, urlparse

import boto3
import pytest
from botocore.exceptions import ClientError
from moto.core import DEFAULT_ACCOUNT_ID
from moto.ses.models import ses_backends

from lambdas.common import ices_dynamo, mailer
from lambdas.common.late import deadline_for
from lambdas.common.unsubscribe import verify
from lambdas.cron_tick.handler import handler as cron_tick
from tests.test_finalize import SCHEDULED, web  # noqa: F401 -- web is a fixture
from tests.test_writeups import publish, upload_and_render

NOW = datetime(2026, 9, 29, 12, tzinfo=timezone.utc)
ME = "sub-me"
OTHER = "sub-other"
ALL_ON = {"iced": True, "due48h": True, "due6h": True, "lateAdded": True, "edition": True, "videoOfMine": True}


@pytest.fixture
def mail(aws):
    boto3.client("ses").verify_domain_identity(Domain="smirnoff-league.com")
    aws.put_parameter(Name="/smirnoff/email-sender", Type="String", Value="alerts@smirnoff-league.com")
    aws.put_parameter(Name="/smirnoff/email-config-set", Type="String", Value="smirnoff-mail")
    aws.put_parameter(Name="/smirnoff/api-url", Type="String", Value="https://api.smirnoff-league.com")
    user(ME, 5)
    user(OTHER, 6)
    return aws


def user(sub, roster, opt_in=True, address="default", **types):
    item = {
        "sub": sub,
        "rosterId": roster,
        "email": {"optIn": opt_in, "types": {**ALL_ON, **types}},
    }
    if address:
        item["emailAddress"] = f"{sub}@example.com" if address == "default" else address
    boto3.resource("dynamodb").Table(os.environ["USERS_TABLE"]).put_item(Item=item)


def sent():
    """Every message moto accepted, parsed, oldest first."""
    raw = ses_backends[DEFAULT_ACCOUNT_ID]["us-east-1"].sent_messages
    return [email.message_from_string(m.raw_data, policy=policy.default) for m in raw]


def to(messages):
    return sorted(m["To"] for m in messages)


def ice(ice_id, roster, week=3, reason="lowest", created=NOW, status="owed", source="cron", **extra):
    ices_dynamo.put_ice(
        {"id": ice_id, "week": week, "rosterId": roster, "reason": reason, **extra},
        created.isoformat(timespec="seconds"),
        source,
    )
    if status != "owed":
        ices_dynamo.update_ice(ice_id, {"status": status})


def week(n, deadline):
    table = boto3.resource("dynamodb").Table(os.environ["SETTINGS_TABLE"])
    table.put_item(
        Item={
            "season": "2026",
            "key": f"WEEK#{n:02d}",
            "finalizedAt": "2026-09-01T00:00:00+00:00",
            "deadlineUtc": deadline.isoformat(),
        }
    )


def video(media_id, ice_ids, roster_ids, uploader, created=NOW, status="ready"):
    boto3.resource("dynamodb").Table(os.environ["MEDIA_TABLE"]).put_item(
        Item={
            "kind": "video",
            "mediaId": media_id,
            "iceIds": ice_ids,
            "rosterIds": roster_ids,
            "uploaderSub": uploader,
            "status": status,
            "createdAt": created.isoformat(timespec="seconds"),
        }
    )


def test_iced_sends_once_to_the_iced_roster(mail):
    ice("W03#R05#LOWEST", 5)
    ice("W03#R05#S1", 5, reason="zero")

    mailer.run(NOW)
    mailer.run(NOW)

    messages = sent()
    assert to(messages) == [f"{ME}@example.com"]
    assert messages[0]["Subject"] == "You've been iced: Week 3"
    assert "https://smirnoff-league.com/?open=ices" in messages[0].get_body(("html",)).get_content()


def test_old_admin_and_voided_ices_do_not_mail(mail):
    ice("W01#R05#LOWEST", 5, week=1, created=NOW - timedelta(days=14))
    ice("W03#R05#ADMIN1", 5, reason="admin", source="admin")
    ice("W03#R05#LOWEST", 5, status="voided")

    mailer.run(NOW)

    assert sent() == []


def test_due_windows_across_the_fall_back_change(mail):
    # Last kickoff the Monday before DST ends: the deadline is Sunday 1 Nov
    # 13:00 EST, which is 18:00 UTC, not the 17:00 UTC it would be in EDT.
    deadline = deadline_for(datetime(2026, 10, 27, 0, 15, tzinfo=timezone.utc))
    assert deadline == datetime(2026, 11, 1, 18, tzinfo=timezone.utc)
    week(8, deadline)
    ice("W08#R05#LOWEST", 5, week=8, created=deadline - timedelta(days=5))
    ice("W08#R06#LOWEST", 6, week=8, created=deadline - timedelta(days=5), status="completed")

    mailer.run(deadline - timedelta(hours=48, seconds=1))
    assert sent() == []

    mailer.run(deadline - timedelta(hours=48))
    mailer.run(deadline - timedelta(hours=30))
    assert [m["Subject"] for m in sent()] == ["Ice due in 48 hours"]

    mailer.run(deadline - timedelta(hours=6, seconds=1))
    assert len(sent()) == 1

    mailer.run(deadline - timedelta(hours=6))
    mailer.run(deadline - timedelta(hours=1))
    mailer.run(deadline + timedelta(hours=1))
    assert [m["Subject"] for m in sent()] == ["Ice due in 48 hours", "6 hours left to chug"]
    assert to(sent()) == [f"{ME}@example.com"] * 2


def test_inside_six_hours_only_the_six_hour_mail_goes(mail):
    deadline = NOW + timedelta(hours=3)
    week(3, deadline)
    ice("W03#R05#LOWEST", 5, created=NOW - timedelta(days=5))

    mailer.run(NOW)

    assert [m["Subject"] for m in sent()] == ["6 hours left to chug"]


def test_late_ice_sends_once(mail):
    ice("W02#R05#LOWEST", 5, week=2, created=NOW - timedelta(days=9))
    ice("W02#R05#LOWEST#LATE1", 5, week=2, reason="late", parentIceId="W02#R05#LOWEST")

    mailer.run(NOW)
    mailer.run(NOW)

    assert [m["Subject"] for m in sent()] == ["Late ice added"]
    assert to(sent()) == [f"{ME}@example.com"]


def test_video_of_my_ice_mails_me_but_not_the_uploader(mail):
    ice("W03#R05#LOWEST", 5, created=NOW - timedelta(days=5))
    ice("W03#R06#LOWEST", 6, created=NOW - timedelta(days=5))
    video("W03#vid1", ["W03#R05#LOWEST", "W03#R06#LOWEST"], [5, 6], OTHER)
    video("W03#vid2", ["W03#R05#LOWEST"], [5], ME)
    video("W03#vid3", ["W03#R05#LOWEST"], [5], OTHER, status="pending")
    video("W03#vid4", ["W03#R05#LOWEST"], [5], OTHER, created=NOW - timedelta(days=3))

    mailer.run(NOW)
    mailer.run(NOW)

    assert [m["Subject"] for m in sent()] == ["Your chug is up"]
    assert to(sent()) == [f"{ME}@example.com"]
    assert "?open=videos" in sent()[0].get_body(("plain",)).get_content()


def test_publishing_an_edition_fans_out_once_to_opted_in_users(mail):
    user("sub-quiet", 7, opt_in=False)
    user("sub-no-edition", 8, edition=False)
    user("sub-no-address", 9, address=None)
    user("sub-no-roster", None)
    mail.put_parameter(Name="/smirnoff/admin-emails", Type="StringList", Value="player@example.com", Overwrite=True)
    media_id = upload_and_render()

    assert publish(media_id)[0] == 200
    assert to(sent()) == [f"{ME}@example.com", "sub-no-roster@example.com", f"{OTHER}@example.com"]
    assert {m["Subject"] for m in sent()} == {"New from the commish: Week 3 Edition"}
    assert "?open=writeup:3" in sent()[0].get_body(("html",)).get_content()

    publish(media_id, published=False)
    publish(media_id)
    mailer.run(datetime.now(timezone.utc))
    assert len(sent()) == 3


def test_cron_catches_an_edition_the_publish_missed(mail, monkeypatch):
    mail.put_parameter(Name="/smirnoff/admin-emails", Type="StringList", Value="player@example.com", Overwrite=True)
    media_id = upload_and_render()
    monkeypatch.setattr(mailer, "send_edition", lambda *a: 1 / 0)

    assert publish(media_id)[0] == 200
    assert sent() == []

    mailer.run(datetime.now(timezone.utc))
    assert len(sent()) == 2


def test_type_toggles_and_opt_in_are_respected(mail):
    user(ME, 5, iced=False)
    user(OTHER, 6, opt_in=False)
    ice("W03#R05#LOWEST", 5)
    ice("W03#R06#LOWEST", 6)

    mailer.run(NOW)

    assert sent() == []


def test_list_unsubscribe_headers_and_parts(mail):
    ice("W03#R05#LOWEST", 5)

    mailer.run(NOW)

    (message,) = sent()
    assert message["From"] == "Smirnoff League <alerts@smirnoff-league.com>"
    assert message["List-Unsubscribe-Post"] == "List-Unsubscribe=One-Click"
    header = message["List-Unsubscribe"]
    assert header.startswith("<https://api.smirnoff-league.com/email/unsubscribe?token=") and header.endswith(">")
    token = parse_qs(urlparse(header[1:-1]).query)["token"][0]
    assert verify(token) == (ME, "all")

    html = message.get_body(("html",)).get_content()
    text = message.get_body(("plain",)).get_content()
    assert "https://smirnoff-league.com/brand/crest.png" in html
    assert "/email/unsubscribe?token=" in html and "/email/unsubscribe?token=" in text
    assert "<script" not in html and "<link" not in html


def test_a_failed_send_is_retried_next_run(mail, monkeypatch):
    ice("W03#R05#LOWEST", 5)
    ice("W03#R06#LOWEST", 6)
    real = mailer._ses()

    class Flaky:
        def send_email(self, **kw):
            if "sub-me@example.com" in kw["Content"]["Raw"]["Data"].decode():
                raise ClientError({"Error": {"Code": "Throttling", "Message": "slow down"}}, "SendEmail")
            return real.send_email(**kw)

    monkeypatch.setattr(mailer, "_ses", lambda: Flaky())
    assert mailer.run(NOW) == {"sent": 1, "failed": 1}
    assert to(sent()) == [f"{OTHER}@example.com"]

    monkeypatch.setattr(mailer, "_ses", lambda: real)
    assert mailer.run(NOW) == {"sent": 1, "failed": 0}
    assert mailer.run(NOW) == {"sent": 0, "failed": 0}
    assert to(sent()) == [f"{ME}@example.com", f"{OTHER}@example.com"]


def test_a_concurrent_run_cannot_claim_a_sent_event(mail):
    assert mailer.claim(ME, "iced#W03", NOW)
    assert not mailer.claim(ME, "iced#W03", NOW)


def test_cron_tick_mails_the_weeks_it_finalizes(mail, web):
    result = cron_tick(SCHEDULED, None)

    assert result["mail"] == {"sent": 1, "failed": 0}
    assert [(m["To"], m["Subject"]) for m in sent()] == [(f"{OTHER}@example.com", "You've been iced: Week 1")]


def test_a_mailer_crash_does_not_fail_the_tick(mail, web, monkeypatch):
    monkeypatch.setattr(mailer, "run", lambda now: 1 / 0)

    result = cron_tick(SCHEDULED, None)

    assert result["mail"] is None and len(result["finalized"]) == 2
