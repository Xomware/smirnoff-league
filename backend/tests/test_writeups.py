import base64
import io
import json
import os
import re

import boto3
import pypdfium2 as pdfium
import pytest
import requests
from PIL import Image

from lambdas.admin_writeup_presign.handler import handler as presign_handler
from lambdas.admin_writeup_publish.handler import handler as publish_handler
from lambdas.writeup_render.handler import handler as render_handler
from lambdas.writeups_list.handler import handler as list_handler
from tests.conftest import set_admins
from tests.events import authorized_event

WRITEUP = {"week": 3, "title": "Week 3: the ice age"}
# Distinct heights, so each page's rendered size proves which page it is.
PAGE_HEIGHTS = (792, 396, 1008)
RENDERED_HEIGHTS = [1812, 906, 2306]


@pytest.fixture
def admin(aws):
    set_admins(aws, "player@example.com")
    return aws


def call(handler, path, method="POST", body=None, **kw):
    res = handler(authorized_event(path=path, method=method, body=body, **kw), None)
    return res["statusCode"], json.loads(res["body"])


def presign(body=WRITEUP, **kw):
    return call(presign_handler, "/admin/writeup-presign", body=body, **kw)


def publish(media_id, published=True, **kw):
    body = {"mediaId": media_id, "published": published}
    return call(publish_handler, "/admin/writeup-publish", body=body, **kw)


def list_writeups():
    return call(list_handler, "/writeups/list", method="GET")


def make_pdf() -> bytes:
    pdf = pdfium.PdfDocument.new()
    for height in PAGE_HEIGHTS:
        pdf.new_page(612, height)
    buf = io.BytesIO()
    pdf.save(buf)
    return buf.getvalue()


def s3_event(key):
    bucket = os.environ["MEDIA_BUCKET"]
    return {
        "Records": [
            {
                "eventSource": "aws:s3",
                "eventName": "ObjectCreated:Post",
                "s3": {"bucket": {"name": bucket}, "object": {"key": key}},
            }
        ]
    }


def upload_and_render(pdf=None):
    _, res = presign()
    key = res["data"]["fields"]["key"]
    boto3.client("s3").put_object(Bucket=os.environ["MEDIA_BUCKET"], Key=key, Body=pdf or make_pdf())
    render_handler(s3_event(key), None)
    return res["data"]["mediaId"]


def media_row(media_id):
    table = boto3.resource("dynamodb").Table(os.environ["MEDIA_TABLE"])
    return table.get_item(Key={"kind": "writeup", "mediaId": media_id})["Item"]


def webp_size(data):
    image = Image.open(io.BytesIO(data))
    assert image.format == "WEBP"
    return image.size


def test_presign_returns_capped_pdf_post_and_pending_row(admin):
    status, res = presign()
    assert status == 200
    data = res["data"]
    fields = data["fields"]
    key = fields["key"]
    writeup_id = key.split("/")[1]
    assert key == f"writeups/{writeup_id}/source.pdf"
    assert data["mediaId"] == f"W03#{writeup_id}"

    conditions = json.loads(base64.b64decode(fields["policy"]))["conditions"]
    assert ["content-length-range", 1, 30 * 1024 * 1024] in conditions
    assert {"Content-Type": "application/pdf"} in conditions

    row = media_row(data["mediaId"])
    assert (row["status"], row["week"], row["title"], row["pdfKey"]) == ("pending", 3, WRITEUP["title"], key)
    assert row["pageKeys"] == []


@pytest.mark.parametrize(
    ("patch", "field"),
    [({"week": 0}, "week"), ({"week": "3"}, "week"), ({"title": " "}, "title"), ({"title": "x" * 121}, "title")],
)
def test_presign_rejects_bad_body(admin, patch, field):
    status, res = presign({**WRITEUP, **patch})
    assert status == 400
    assert res["error"]["detail"] == {"field": field}


def test_non_admin_presign_and_publish_are_403(admin):
    _, res = presign()
    media_id = res["data"]["mediaId"]
    set_admins(admin, "commish@example.com")
    assert presign()[0] == 403
    assert publish(media_id)[0] == 403


def test_render_writes_one_webp_per_page_in_order(admin):
    media_id = upload_and_render()

    row = media_row(media_id)
    writeup_id = media_id.split("#")[1]
    assert row["status"] == "rendered"
    assert row["pageKeys"] == [f"writeups/{writeup_id}/p{n}.webp" for n in (1, 2, 3)]

    s3 = boto3.client("s3")
    sizes = []
    for key in row["pageKeys"]:
        obj = s3.get_object(Bucket=os.environ["MEDIA_BUCKET"], Key=key)
        assert obj["ContentType"] == "image/webp"
        sizes.append(webp_size(obj["Body"].read()))
    assert sizes == [(1400, h) for h in RENDERED_HEIGHTS]


def test_render_of_a_broken_pdf_marks_the_row_failed(admin):
    media_id = upload_and_render(pdf=b"%PDF-1.7 not really")
    row = media_row(media_id)
    assert (row["status"], row["pageKeys"]) == ("failed", [])


def test_render_of_a_41_page_pdf_fails_without_rendering(admin):
    pdf = pdfium.PdfDocument.new()
    for _ in range(41):
        pdf.new_page(612, 792)
    buf = io.BytesIO()
    pdf.save(buf)
    row = media_row(upload_and_render(pdf=buf.getvalue()))
    assert (row["status"], row["failReason"], row["pageKeys"]) == ("failed", "too many pages", [])


def with_media_box(box: bytes) -> bytes:
    return re.sub(rb"/MediaBox\s*\[[^\]]*\]", b"/MediaBox " + box, make_pdf(), count=1)


def test_render_of_a_zero_width_page_does_not_crash(admin):
    # PDFium swaps an exactly-zero box for US Letter, so this one renders.
    row = media_row(upload_and_render(pdf=with_media_box(b"[0 0 0 792]")))
    assert row["status"] == "rendered"


def test_render_of_a_sliver_page_fails_instead_of_allocating(admin):
    # At 1400px wide this page would render about 11 billion pixels tall.
    row = media_row(upload_and_render(pdf=with_media_box(b"[0 0 0.0001 792]")))
    assert (row["status"], row["failReason"], row["pageKeys"]) == ("failed", "bad page size", [])


def test_a_page_render_error_marks_the_row_failed(admin, monkeypatch):
    def boom(*args, **kwargs):
        raise RuntimeError("pdfium fell over")

    monkeypatch.setattr(pdfium.PdfPage, "render", boom)
    row = media_row(upload_and_render())
    assert (row["status"], row["failReason"], row["pageKeys"]) == ("failed", "render error", [])


def test_render_ignores_a_pdf_with_no_row(admin):
    key = "writeups/unknown/source.pdf"
    boto3.client("s3").put_object(Bucket=os.environ["MEDIA_BUCKET"], Key=key, Body=make_pdf())
    render_handler(s3_event(key), None)


def test_publishing_an_unrendered_writeup_is_409(admin):
    _, res = presign()
    assert publish(res["data"]["mediaId"])[0] == 409


def test_publish_unknown_writeup_is_404(admin):
    assert publish("W03#nope")[0] == 404


def test_publish_requires_a_bool(admin):
    status, res = publish(upload_and_render(), published="yes")
    assert status == 400
    assert res["error"]["detail"] == {"field": "published"}


def test_unpublished_writeups_are_not_listed(admin):
    media_id = upload_and_render()
    assert list_writeups()[1]["data"] == []

    publish(media_id)
    assert [w["mediaId"] for w in list_writeups()[1]["data"]] == [media_id]

    publish(media_id, published=False)
    assert list_writeups()[1]["data"] == []


def test_list_is_newest_week_first(admin):
    ids = {}
    for week in (2, 5, 1):
        _, res = presign({**WRITEUP, "week": week})
        key = res["data"]["fields"]["key"]
        boto3.client("s3").put_object(Bucket=os.environ["MEDIA_BUCKET"], Key=key, Body=make_pdf())
        render_handler(s3_event(key), None)
        publish(res["data"]["mediaId"])
        ids[week] = res["data"]["mediaId"]

    listed = list_writeups()[1]["data"]
    assert [w["week"] for w in listed] == [5, 2, 1]
    assert [w["mediaId"] for w in listed] == [ids[5], ids[2], ids[1]]


def test_scenario_presign_upload_render_publish_list(admin):
    status, res = presign()
    assert status == 200
    upload = res["data"]

    posted = requests.post(
        upload["url"], data=upload["fields"], files={"file": ("week3.pdf", make_pdf(), "application/pdf")}
    )
    assert posted.status_code in (200, 204)

    render_handler(s3_event(upload["fields"]["key"]), None)
    status, res = publish(upload["mediaId"])
    assert status == 200
    assert res["data"]["publishedAt"]

    status, res = list_writeups()
    assert status == 200
    [writeup] = res["data"]
    assert (writeup["mediaId"], writeup["week"], writeup["title"]) == (upload["mediaId"], 3, WRITEUP["title"])
    assert writeup["publishedAt"]
    assert len(writeup["pages"]) == 3
    assert all("X-Amz-Expires=3600" in url for url in writeup["pages"])

    sizes = []
    for url in writeup["pages"]:
        fetched = requests.get(url)
        assert fetched.status_code == 200
        sizes.append(webp_size(fetched.content))
    assert sizes == [(1400, h) for h in RENDERED_HEIGHTS]
