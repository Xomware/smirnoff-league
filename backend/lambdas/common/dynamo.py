"""
DynamoDB access primitives.

Table handles are resolved lazily: `table()` reads the env var at call time,
so a test can point at a moto table after import.

The float/Decimal conversion below is not optional. The boto3 resource API
raises TypeError on a bare float, and ice points are floats.
"""

from __future__ import annotations

import os
from decimal import Decimal
from typing import Any

import boto3

_resource = None


def resource():
    """One cached resource per container. Region comes from the Lambda env."""
    global _resource
    if _resource is None:
        _resource = boto3.resource(
            "dynamodb", region_name=os.environ.get("AWS_REGION", "us-east-1")
        )
    return _resource


def table(env_var: str):
    name = os.environ.get(env_var)
    if not name:
        raise RuntimeError(f"{env_var} is not set")
    return resource().Table(name)


def query_all(tbl, **kwargs) -> list[dict]:
    """Query, following LastEvaluatedKey. Same shape as derby's helper."""
    items: list[dict] = []
    last = None
    while True:
        if last is not None:
            kwargs["ExclusiveStartKey"] = last
        page = tbl.query(**kwargs)
        items.extend(page.get("Items") or [])
        last = page.get("LastEvaluatedKey")
        if not last:
            break
    return items


def to_dynamo(value: Any) -> Any:
    """
    floats -> Decimal, recursively.

    Via str(), not Decimal(float): Decimal(0.1) is
    0.1000000000000000055511151231257827, which Dynamo stores verbatim and
    which then fails an equality check against the value that produced it.
    """
    if isinstance(value, bool):
        return value
    if isinstance(value, float):
        return Decimal(str(value))
    if isinstance(value, dict):
        return {k: to_dynamo(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [to_dynamo(v) for v in value]
    return value


def from_dynamo(value: Any) -> Any:
    """Decimal -> int where exact, else float. The inverse of to_dynamo."""
    if isinstance(value, bool):
        return value
    if isinstance(value, Decimal):
        as_int = int(value)
        return as_int if value == as_int else float(value)
    if isinstance(value, dict):
        return {k: from_dynamo(v) for k, v in value.items()}
    if isinstance(value, list):
        return [from_dynamo(v) for v in value]
    return value
