"""
Alert email bodies. Each type returns (subject, heading, lines, CTA label, ?open= value)
and render() wraps it in the branded layout plus a plain-text twin.

The HTML is tables and inline styles only, with web-safe fonts, because Gmail
strips <style> in some views and Outlook renders with Word.
"""

from __future__ import annotations

from datetime import datetime
from html import escape

from lambdas.common.email_prefs import EMAIL_TYPES
from lambdas.common.late import ET

NAVY = "#14224a"
RED = "#d4202c"
INK = "#101a3a"
MIST = "#e6ecf6"
FONT = "font-family:Arial,Helvetica,sans-serif;"


def _ices(count: int) -> str:
    return "1 Smirnoff Ice" if count == 1 else f"{count} Smirnoff Ices"


def _when(deadline: datetime) -> str:
    d = deadline.astimezone(ET)
    return f"{d:%A, %B} {d.day} at {d.hour % 12 or 12}:{d:%M} {d:%p} ET"


def iced(week: int, count: int) -> tuple:
    lines = [
        f"Week {week} is final and your team owes {_ices(count)}.",
        "Chug it and post the video before Sunday's 1:00 PM ET deadline. Every week past it adds a late ice.",
    ]
    return f"You've been iced: Week {week}", "You've been iced", lines, "Open the ledger", "ices"


def _due(week: int, count: int, deadline: datetime) -> list[str]:
    return [
        f"You still owe {_ices(count)} from Week {week}.",
        f"The deadline is {_when(deadline)}. Miss it and a late ice gets added.",
    ]


def due48h(week: int, count: int, deadline: datetime) -> tuple:
    return "Ice due in 48 hours", "48 hours to chug", _due(week, count, deadline), "Open the ledger", "ices"


def due6h(week: int, count: int, deadline: datetime) -> tuple:
    return "6 hours left to chug", "6 hours left", _due(week, count, deadline), "Open the ledger", "ices"


def late_added(week: int) -> tuple:
    lines = [
        f"Your Week {week} ice went past its deadline, so a late ice was added to your tab.",
        "Another one lands every week the original stays unpaid.",
    ]
    return "Late ice added", "Late ice added", lines, "Open the ledger", "ices"


def edition(week: int, title: str) -> tuple:
    lines = ["The commish just posted a new write-up.", title]
    return f"New from the commish: Week {week} Edition", f"Week {week} Edition", lines, "Read it", f"writeup:{week}"


def video_of_mine(week: int) -> tuple:
    lines = [f"Someone posted a video of your Week {week} chug.", "Go see how it looks from the outside."]
    return "Your chug is up", "Your chug is up", lines, "Watch it", "videos"


RENDERERS = {
    "iced": iced,
    "due48h": due48h,
    "due6h": due6h,
    "lateAdded": late_added,
    "edition": edition,
    "videoOfMine": video_of_mine,
}


def render(kind: str, ctx: dict, site: str, unsub_type: str, unsub_all: str) -> tuple[str, str, str]:
    """(subject, html, text) for one alert."""
    subject, heading, lines, cta, target = RENDERERS[kind](**ctx)
    cta_url = f"{site}/?open={target}"
    label = EMAIL_TYPES[kind]
    paragraphs = "".join(
        f'<p style="margin:0 0 14px;{FONT}font-size:16px;line-height:24px;color:{INK};">{escape(line)}</p>'
        for line in lines
    )
    link = "color:#ffffff;text-decoration:underline;"
    html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>{escape(subject)}</title>
</head>
<body style="margin:0;padding:0;background:{MIST};">
<div style="display:none;max-height:0;overflow:hidden;">{escape(lines[0])}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="{MIST}" style="background:{MIST};">
<tr><td align="center" style="padding:24px 12px;">
<!--[if mso]><table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="max-width:560px;background:#ffffff;">
<tr><td align="center" bgcolor="{NAVY}" style="background:{NAVY};padding:24px 24px 18px;border-bottom:4px solid {RED};">
<a href="{escape(site)}"><img src="{escape(site)}/brand/crest.png" width="72" height="87" alt="Smirnoff League" style="display:block;border:0;width:72px;height:87px;"></a>
<p style="margin:10px 0 0;{FONT}font-size:13px;line-height:18px;font-weight:bold;letter-spacing:3px;color:#ffffff;">SMIRNOFF LEAGUE</p>
</td></tr>
<tr><td style="padding:28px 28px 6px;">
<h1 style="margin:0 0 14px;{FONT}font-size:26px;line-height:32px;font-weight:bold;color:{NAVY};">{escape(heading)}</h1>
{paragraphs}
</td></tr>
<tr><td align="center" style="padding:10px 28px 32px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td align="center" bgcolor="{RED}" style="background:{RED};border-radius:4px;">
<a href="{escape(cta_url)}" style="display:inline-block;padding:14px 32px;{FONT}font-size:16px;line-height:20px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:4px;">{escape(cta)}</a>
</td></tr></table>
</td></tr>
<tr><td align="center" bgcolor="{NAVY}" style="background:{NAVY};padding:18px 28px;{FONT}font-size:12px;line-height:20px;color:#c9d3ea;">
You get this because you turned on email alerts at <a href="{escape(site)}" style="{link}">{escape(site.removeprefix("https://"))}</a>.<br>
<a href="{escape(unsub_type)}" style="{link}">Stop &ldquo;{escape(label)}&rdquo; emails</a> &middot; <a href="{escape(unsub_all)}" style="{link}">Unsubscribe from all</a>
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>"""
    body = "\n\n".join(lines)
    text = f"""{heading}

{body}

{cta}: {cta_url}

--
Smirnoff League
Stop "{label}" emails: {unsub_type}
Unsubscribe from all: {unsub_all}
"""
    return subject, html, text
