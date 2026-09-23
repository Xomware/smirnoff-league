"""
GET /admin/users - every profile with sign-in stats, for the Control Panel. Admins only.

The claimed team is `rosterId`; the frontend names it from its Sleeper cache.
"""

from __future__ import annotations

from lambdas.common.admins import require_admin
from lambdas.common.api import api_handler, ok
from lambdas.common.users_dynamo import list_profiles

FIELDS = (
    "sub",
    "name",
    "username",
    "emailAddress",
    "rosterId",
    "createdAt",
    "lastSeenAt",
    "signInCount",
    "lastUa",
)


@api_handler("admin_users")
def handler(event, context):
    require_admin(event)
    return ok(
        [
            {**{k: p[k] for k in FIELDS}, "emailOptIn": p["email"]["optIn"]}
            for p in list_profiles()
        ]
    )
