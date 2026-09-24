"""
POST /videos/comment-delete - delete a comment. The author or an admin only.

Body: { "videoId": "W{ww}#{uuid}", "commentId": str }
Returns the video's social payload.
"""

from __future__ import annotations

from lambdas.common import social_dynamo as social
from lambdas.common.admins import is_admin
from lambdas.common.api import (
    ForbiddenError,
    NotFoundError,
    api_handler,
    body,
    caller_email,
    caller_sub,
    ok,
    require,
)


@api_handler("videos_comment_delete")
def handler(event, context):
    sub = caller_sub(event)
    video_id, comment_id = require(body(event), "videoId", "commentId")

    comment = next((c for c in social.comments(video_id) if c["commentId"] == comment_id), None)
    if comment is None:
        raise NotFoundError("Comment not found")
    if comment["sub"] != sub and not is_admin(caller_email(event)):
        raise ForbiddenError("Only the author or an admin can delete this comment")

    social.delete_comment(comment)
    return ok(social.payload(video_id, sub))
