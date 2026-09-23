"""
S3 ObjectCreated on writeups/*/source.pdf - rasterize each page to a ~1400px-wide WebP.

Pages go to writeups/{uuid}/p{n}.webp (n from 1), their keys are stored in
order on the media row, and the row becomes `rendered`. Any failure marks the
row `failed` with a failReason, so the admin UI never waits on a row stuck in
`pending`. Retrying the same bytes would fail the same way, so nothing is
raised back to S3's async retries.
"""

from __future__ import annotations

import io
from urllib.parse import unquote_plus

import pypdfium2 as pdfium

from lambdas.common import media_dynamo as media
from lambdas.common.logger import get_logger

log = get_logger(__file__)

WIDTH = 1400
QUALITY = 85
# Bounds the work so a render finishes well inside the 120s timeout. A real
# write-up is around 10 pages.
MAX_PAGES = 40
# Ten times a portrait page's height. A sliver-wide page box scaled to WIDTH
# asks PDFium for billions of pixels, which kills the process outright.
MAX_HEIGHT = WIDTH * 10


class Unrenderable(Exception):
    """A PDF this handler refuses to render. The message is the row's failReason."""


def handler(event, context):
    for record in event["Records"]:
        # S3 event keys arrive URL-encoded, spaces as '+'.
        render(unquote_plus(record["s3"]["object"]["key"]))


def render(pdf_key: str) -> None:
    writeup = media.writeup_for_pdf(pdf_key)
    if writeup is None:
        log.warning("no write-up row for %s, skipping", pdf_key)
        return

    source = media.s3().get_object(Bucket=media.bucket(), Key=pdf_key)["Body"].read()
    try:
        page_keys = render_pages(source, pdf_key.rsplit("/", 1)[0])
    except Exception as e:
        log.exception("could not render %s", pdf_key)
        reason = str(e) if isinstance(e, Unrenderable) else "render error"
        media.set_writeup_status(writeup["mediaId"], "failed", [], reason)
        return

    media.set_writeup_status(writeup["mediaId"], "rendered", page_keys)
    log.info("rendered %s: %d pages", writeup["mediaId"], len(page_keys))


def render_pages(source: bytes, prefix: str) -> list[str]:
    page_keys = []
    with pdfium.PdfDocument(source) as pdf:
        if len(pdf) > MAX_PAGES:
            raise Unrenderable("too many pages")
        for n, page in enumerate(pdf, start=1):
            width, height = page.get_size()
            if width <= 0 or height <= 0 or height * WIDTH / width > MAX_HEIGHT:
                raise Unrenderable("bad page size")
            image = page.render(scale=WIDTH / width).to_pil()
            buf = io.BytesIO()
            image.save(buf, "WEBP", quality=QUALITY)
            key = f"{prefix}/p{n}.webp"
            media.s3().put_object(
                Bucket=media.bucket(), Key=key, Body=buf.getvalue(), ContentType="image/webp"
            )
            page_keys.append(key)
    return page_keys
