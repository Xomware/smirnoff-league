"""
GET /users/me - the caller's identity, stored profile (null until onboarded) and admin flag.

Also refreshes the profile's `emailAddress` from the token, since that is where
alert emails go and a user never types it.
"""

from __future__ import annotations

from lambdas.common.admins import is_admin
from lambdas.common.api import api_handler, caller_email, caller_sub, ok
from lambdas.common.users_dynamo import get_profile, update_profile


@api_handler("users_me")
def handler(event, context):
    sub = caller_sub(event)
    email = caller_email(event)
    profile = get_profile(sub)
    if profile and profile["emailAddress"] != email:
        profile = update_profile(sub, {"emailAddress": email})
    return ok({"sub": sub, "email": email, "profile": profile, "isAdmin": is_admin(email)})
