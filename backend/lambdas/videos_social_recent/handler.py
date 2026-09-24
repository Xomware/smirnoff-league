"""
GET /videos/social-recent - other members' comments on the caller's chug videos, newest first.

A video is the caller's when their roster is one it covers or they uploaded it.
Feeds the client-derived notification list; capped at the newest LIMIT.
"""

from __future__ import annotations

from lambdas.common import media_dynamo as media
from lambdas.common import social_dynamo as social
from lambdas.common.api import api_handler, caller_sub, ok

LIMIT = 50


@api_handler("videos_social_recent")
def handler(event, context):
    sub = caller_sub(event)
    roster_id = social.member(sub)["rosterId"]

    mine = [
        v
        for v in media.ready_videos()
        if v["uploaderSub"] == sub or roster_id in media.covered(v)[1]
    ]
    profiles: dict[str, dict] = {}
    items = [
        {
            "videoId": v["mediaId"],
            "week": int(v["mediaId"][1:3]),
            "id": c["commentId"],
            "author": social.author(c["sub"], profiles),
            "text": c["text"],
            "createdAt": c["createdAt"],
        }
        for v in mine
        for c in social.comments(v["mediaId"])
        if c["sub"] != sub
    ]
    return ok(sorted(items, key=lambda i: i["createdAt"], reverse=True)[:LIMIT])
