"""
GET|POST /email/unsubscribe?token=... - turn off one alert type, or all email, with no sign-in.

The route has no authorizer: the signed token (common/unsubscribe.py) is the
only credential, and all it can do is turn email off. GET is the link in an
email's footer. POST is RFC 8058 one-click, which mail clients send to the
List-Unsubscribe URL with the body `List-Unsubscribe=One-Click`. Both answer
with a small HTML page, not the JSON envelope, because a person reads it.
"""

from __future__ import annotations

import os

from lambdas.common.api import api_handler, query
from lambdas.common.email_prefs import EMAIL_TYPES
from lambdas.common.unsubscribe import verify
from lambdas.common.users_dynamo import get_profile, update_profile

PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>{title} - Smirnoff League</title>
<style>
body {{ margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 1rem;
  box-sizing: border-box; font: 15px Tahoma, Verdana, sans-serif; background: #3a6ea5; }}
.win {{ max-width: 26rem; border: 3px solid #0831d9; border-radius: 8px 8px 0 0; background: #ece9d8;
  box-shadow: 4px 4px 12px rgb(0 0 0 / 0.4); }}
.bar {{ padding: 0.4rem 0.6rem; color: #fff; font-weight: bold; border-radius: 5px 5px 0 0;
  background: linear-gradient(#0a5ee8, #0842c0); }}
.body {{ padding: 1rem 1.25rem; line-height: 1.5; }}
a {{ color: #0842c0; font-weight: bold; }}
</style>
</head>
<body>
<main class="win">
<div class="bar">Smirnoff League</div>
<div class="body"><p>{message}</p><p>Manage alerts at <a href="{site}">{host}</a>.</p></div>
</main>
</body>
</html>"""


def _page(status: int, title: str, message: str) -> dict:
    # The site is the first CORS origin; locals.tf puts the domain there.
    site = os.environ["CORS_ALLOW_ORIGIN"].split(",")[0]
    host = site.removeprefix("https://")
    return {
        "statusCode": status,
        "headers": {"Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store"},
        "body": PAGE.format(title=title, message=message, site=site, host=host),
        "isBase64Encoded": False,
    }


@api_handler("email_unsubscribe")
def handler(event, context):
    # The route is ANY, since the module gives each path one method.
    if event.get("httpMethod") not in ("GET", "POST"):
        return _page(405, "Not allowed", "Open the unsubscribe link from your email.")

    parsed = verify(query(event).get("token") or "")
    if parsed is None:
        return _page(400, "Link not valid", "That unsubscribe link is not valid. Copy the whole link from the email.")
    sub, kind = parsed

    profile = get_profile(sub)
    if profile is None:
        return _page(404, "Not found", "That account no longer has a profile, so it gets no email.")

    prefs = profile["email"]
    if kind == "all":
        prefs = {**prefs, "optIn": False}
        what = "all Smirnoff League emails"
    else:
        prefs = {**prefs, "types": {**prefs["types"], kind: False}}
        what = f"&ldquo;{EMAIL_TYPES[kind]}&rdquo; emails"
    update_profile(sub, {"email": prefs})
    return _page(200, "Unsubscribed", f"You&rsquo;re unsubscribed from {what}.")
