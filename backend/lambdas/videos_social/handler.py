"""
GET /videos/social - reactions and comments on one ready chug video.

Query: ?videoId=W{ww}#{uuid}
Returns { reactions: {type: {count, mine, by: [displayName]}}, comments: [{id, author, text, createdAt, mine}] },
comments oldest first. Authors carry rosterId and displayName, never an email.
"""

from __future__ import annotations

from lambdas.common import social_dynamo as social
from lambdas.common.api import api_handler, caller_sub, ok, query, require


@api_handler("videos_social")
def handler(event, context):
    sub = caller_sub(event)
    (video_id,) = require(query(event), "videoId")
    social.ready_video(video_id)
    return ok(social.payload(video_id, sub))
