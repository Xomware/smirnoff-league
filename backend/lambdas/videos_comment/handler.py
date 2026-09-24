"""
POST /videos/comment - comment on a ready chug video.

Body: { "videoId": "W{ww}#{uuid}", "text": 1..280 chars once trimmed }
At most 10 comments a minute per caller (429 past that). Returns the video's
social payload. The video's chuggers and uploader learn of it through
GET /videos/social-recent, since notifications are derived client-side.
"""

from __future__ import annotations

from lambdas.common import social_dynamo as social
from lambdas.common.api import ValidationError, api_handler, body, caller_sub, ok, require, text

MAX_CHARS = 280


@api_handler("videos_comment")
def handler(event, context):
    sub = caller_sub(event)
    data = body(event)
    (video_id,) = require(data, "videoId")
    comment = text(data, "text")
    if len(comment) > MAX_CHARS:
        raise ValidationError(f"text must be at most {MAX_CHARS} characters", field="text")

    social.member(sub)
    social.ready_video(video_id)
    social.take_comment_slot(sub)
    social.add_comment(video_id, sub, comment)
    return ok(social.payload(video_id, sub))
