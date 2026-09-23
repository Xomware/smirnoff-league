"""smirnoff-media video rows, plus the media bucket they point into."""

from __future__ import annotations

import os

import boto3
from boto3.dynamodb.conditions import Attr, Key
from botocore.config import Config

from lambdas.common.dynamo import from_dynamo, query_all, table, to_dynamo

_s3 = None


def s3():
    global _s3
    if _s3 is None:
        # boto3 presigns GETs with SigV2 in us-east-1, and S3 rejects SigV2 for
        # objects under SSE-KMS, which every object in this bucket is.
        _s3 = boto3.client(
            "s3",
            region_name=os.environ.get("AWS_REGION", "us-east-1"),
            config=Config(signature_version="s3v4"),
        )
    return _s3


def bucket() -> str:
    return os.environ["MEDIA_BUCKET"]


def put_pending(media_id: str, fields: dict) -> None:
    item = {"kind": "video", "mediaId": media_id, **fields, "status": "pending"}
    table("MEDIA_TABLE").put_item(Item=to_dynamo(item))


def get_video(media_id: str) -> dict | None:
    item = table("MEDIA_TABLE").get_item(Key={"kind": "video", "mediaId": media_id}).get("Item")
    return from_dynamo(item) if item else None


def mark_ready(media_id: str, size: int) -> None:
    table("MEDIA_TABLE").update_item(
        Key={"kind": "video", "mediaId": media_id},
        UpdateExpression="SET #status = :ready, #bytes = :bytes",
        # Both are DynamoDB reserved words.
        ExpressionAttributeNames={"#status": "status", "#bytes": "bytes"},
        ExpressionAttributeValues={":ready": "ready", ":bytes": size},
    )


def ready_videos(week: int | None = None) -> list[dict]:
    key = Key("kind").eq("video")
    if week is not None:
        key &= Key("mediaId").begins_with(f"W{week:02d}#")
    items = query_all(
        table("MEDIA_TABLE"), KeyConditionExpression=key, FilterExpression=Attr("status").eq("ready")
    )
    return [from_dynamo(i) for i in items]
