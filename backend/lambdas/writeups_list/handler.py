"""
GET /writeups/list - published write-ups, newest week first, each with 1-hour presigned GETs for its pages in order.
"""

from __future__ import annotations

from lambdas.common import media_dynamo as media
from lambdas.common.api import api_handler, caller_sub, ok

URL_SECONDS = 60 * 60


@api_handler("writeups_list")
def handler(event, context):
    caller_sub(event)
    writeups = sorted(
        media.published_writeups(), key=lambda w: (w["week"], w["publishedAt"]), reverse=True
    )
    return ok(
        [
            {
                "mediaId": w["mediaId"],
                "week": w["week"],
                "title": w["title"],
                "publishedAt": w["publishedAt"],
                "pages": [
                    media.s3().generate_presigned_url(
                        "get_object",
                        Params={"Bucket": media.bucket(), "Key": key},
                        ExpiresIn=URL_SECONDS,
                    )
                    for key in w["pageKeys"]
                ],
            }
            for w in writeups
        ]
    )
