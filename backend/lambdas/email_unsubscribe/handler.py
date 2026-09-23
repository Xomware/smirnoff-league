"""
GET|POST /email/unsubscribe?token=... - turn off one alert type, or all email, with no sign-in.

The route has no authorizer: the signed token (common/unsubscribe.py) is the
only credential, and all it can do is turn email off.

GET never changes anything, because link scanners prefetch GETs. It renders a
confirmation page whose form POSTs the token back. POST does the unsubscribe,
and serves both that form (`application/x-www-form-urlencoded`, token in the
body or query string) and RFC 8058 one-click, which mail clients send to the
List-Unsubscribe URL with the body `List-Unsubscribe=One-Click`.

Mailer contract: `List-Unsubscribe: <this URL with ?token=>`,
`List-Unsubscribe-Post: List-Unsubscribe=One-Click`, and the footer link points
at the same URL, which GETs the confirmation page.

Responses are small HTML pages, not the JSON envelope, because a person reads them.
"""

from __future__ import annotations

import base64
import html
import os
from urllib.parse import parse_qs

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
button {{ min-height: 2.75rem; padding: 0 1.25rem; font: bold 15px Tahoma, Verdana, sans-serif;
  border: 1px solid #003c74; border-radius: 3px; background: linear-gradient(#fff, #ece9d8); cursor: pointer; }}
button:focus-visible {{ outline: 2px dotted #000; outline-offset: -5px; }}
</style>
</head>
<body>
<main class="win">
<div class="bar">Smirnoff League</div>
<div class="body">{content}<p>Manage alerts at <a href="{site}">{host}</a>.</p></div>
</main>
</body>
</html>"""

FORM = """<form method="post">
<input type="hidden" name="token" value="{token}">
<button type="submit">Unsubscribe</button>
</form>"""


def _page(status: int, title: str, content: str) -> dict:
    # The site is the first CORS origin; locals.tf puts the domain there.
    site = os.environ["CORS_ALLOW_ORIGIN"].split(",")[0]
    return {
        "statusCode": status,
        "headers": {"Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store"},
        "body": PAGE.format(title=title, content=content, site=site, host=site.removeprefix("https://")),
        "isBase64Encoded": False,
    }


def _form_token(event: dict) -> str:
    raw = event.get("body") or ""
    if event.get("isBase64Encoded"):
        raw = base64.b64decode(raw).decode()
    return (parse_qs(raw).get("token") or [""])[0]


def _what(kind: str) -> str:
    return "all Smirnoff League emails" if kind == "all" else f"&ldquo;{EMAIL_TYPES[kind]}&rdquo; emails"


@api_handler("email_unsubscribe")
def handler(event, context):
    # The route is ANY, since the module gives each path one method.
    method = event.get("httpMethod")
    if method not in ("GET", "POST"):
        return _page(405, "Not allowed", "<p>Open the unsubscribe link from your email.</p>")

    token = query(event).get("token") or (_form_token(event) if method == "POST" else "")
    parsed = verify(token)
    if parsed is None:
        return _page(400, "Link not valid", "<p>That unsubscribe link is not valid. Copy the whole link from the email.</p>")
    sub, kind = parsed

    if method == "GET":
        content = f"<p>Unsubscribe from {_what(kind)}?</p>" + FORM.format(token=html.escape(token))
        return _page(200, "Unsubscribe", content)

    profile = get_profile(sub)
    if profile is None:
        return _page(404, "Not found", "<p>That account no longer has a profile, so it gets no email.</p>")

    prefs = profile["email"]
    if kind == "all":
        prefs = {**prefs, "optIn": False}
    else:
        prefs = {**prefs, "types": {**prefs["types"], kind: False}}
    update_profile(sub, {"email": prefs})
    return _page(200, "Unsubscribed", f"<p>You&rsquo;re unsubscribed from {_what(kind)}.</p>")
