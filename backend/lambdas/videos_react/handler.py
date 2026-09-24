"""
POST /videos/react - toggle one of the caller's reactions on a ready chug video.

Body: { "videoId": "W{ww}#{uuid}", "type": "glacier" | "stopwatch" | "bottle" | "siren" | "crown" }
Returns the video's social payload, as GET /videos/social does.
"""

from __future__ import annotations

from lambdas.common import social_dynamo as social
from lambdas.common.api import ValidationError, api_handler, body, caller_sub, ok, require


@api_handler("videos_react")
def handler(event, context):
    sub = caller_sub(event)
    data = body(event)
    (video_id,) = require(data, "videoId")
    kind = data.get("type")
    if kind not in social.REACTIONS:
        raise ValidationError(f"type must be one of {', '.join(social.REACTIONS)}", field="type")

    social.member(sub)
    social.ready_video(video_id)
    social.toggle_reaction(video_id, sub, kind)
    return ok(social.payload(video_id, sub))
