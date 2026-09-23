"""Email alert preferences stored on the profile as `email`: { optIn, types: { <type>: bool } }."""

from __future__ import annotations

from lambdas.common.api import ValidationError

# The labels are the profile toggles' wording, reused on the unsubscribe page.
EMAIL_TYPES = {
    "iced": "When I get iced",
    "due48h": "48 hours before an ice is due",
    "due6h": "6 hours before",
    "lateAdded": "When a late ice is added",
    "edition": "When the commish posts a new edition",
    "videoOfMine": "When someone posts a video of my chug",
}


def default_prefs() -> dict:
    return {"optIn": False, "types": dict.fromkeys(EMAIL_TYPES, True)}


def with_defaults(stored: dict | None) -> dict:
    """Fills gaps so a type added later reads as on, like every type does before opting in."""
    stored = stored or {}
    base = default_prefs()
    return {**base, **stored, "types": {**base["types"], **(stored.get("types") or {})}}


def parse_prefs(value) -> dict:
    """The whole object or nothing: exact keys, and real booleans (bool, not 0/1 or "true")."""
    types = value.get("types") if isinstance(value, dict) else None
    valid = (
        isinstance(value, dict)
        and value.keys() == {"optIn", "types"}
        and type(value["optIn"]) is bool
        and isinstance(types, dict)
        and types.keys() == EMAIL_TYPES.keys()
        and all(type(v) is bool for v in types.values())
    )
    if not valid:
        raise ValidationError(
            f"email must be {{ optIn, types }} with true or false for each of {', '.join(EMAIL_TYPES)}",
            field="email",
        )
    return value
