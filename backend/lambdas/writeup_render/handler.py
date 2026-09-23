"""
S3 ObjectCreated on writeups/*/source.pdf - rasterize each page to a ~1400px-wide WebP.

Pages go to writeups/{uuid}/p{n}.webp (n from 1), their keys are stored in
order on the media row, and the row becomes `rendered`. A PDF that PDFium
cannot open marks the row `failed` so the admin UI can say so; retrying the
same bytes would fail the same way.
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
        pdf = pdfium.PdfDocument(source)
    except pdfium.PdfiumError:
        log.exception("could not open %s", pdf_key)
        media.set_writeup_status(writeup["mediaId"], "failed", [])
        return

    prefix = pdf_key.rsplit("/", 1)[0]
    page_keys = []
    with pdf:
        for n, page in enumerate(pdf, start=1):
            image = page.render(scale=WIDTH / page.get_width()).to_pil()
            buf = io.BytesIO()
            image.save(buf, "WEBP", quality=QUALITY)
            key = f"{prefix}/p{n}.webp"
            media.s3().put_object(
                Bucket=media.bucket(), Key=key, Body=buf.getvalue(), ContentType="image/webp"
            )
            page_keys.append(key)

    media.set_writeup_status(writeup["mediaId"], "rendered", page_keys)
    log.info("rendered %s: %d pages", writeup["mediaId"], len(page_keys))
