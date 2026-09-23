"""A coarse "<device> <browser>" label for the admin Users panel, e.g. "iPhone Safari"."""

from __future__ import annotations

# First match wins. iPad before Mac, since an iPad that says so is one.
DEVICES = (
    ("iPhone", "iPhone"),
    ("iPad", "iPad"),
    ("Android", "Android"),
    ("Macintosh", "Mac"),
    ("Windows", "Windows"),
    ("Linux", "Linux"),
)
# Order matters: Chrome and Edge both claim Safari, and Edge also claims Chrome.
BROWSERS = (
    ("Edg/", "Edge"),
    ("FxiOS", "Firefox"),
    ("Firefox/", "Firefox"),
    ("CriOS", "Chrome"),
    ("Chrome/", "Chrome"),
    ("Safari/", "Safari"),
)


def ua_family(event: dict) -> str:
    headers = {k.lower(): v for k, v in ((event or {}).get("headers") or {}).items()}
    ua = headers.get("user-agent") or ""
    device = next((label for token, label in DEVICES if token in ua), None)
    browser = next((label for token, label in BROWSERS if token in ua), None)
    if not device or not browser:
        return "Other"
    return f"{device} {browser}"
