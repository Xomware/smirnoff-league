"""
Admin edits to smirnoff-ices and smirnoff-settings, shared by the /admin/*
Lambdas and scripts/ice_admin.py.

Every write stamps updatedBy and updatedAt. Late rows are left alone:
late.reconcile brings them in line with completedAt on the next cron tick.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import ROUND_HALF_UP, Decimal

from lambdas.common import ices_dynamo as db
from lambdas.common.api import ConflictError, NotFoundError, ValidationError
from lambdas.common.users_dynamo import get_profile

MAX_CHUG_SECONDS = 600
MAX_CHUGGER_NAME = 40


def stamp(at: datetime | None = None) -> str:
    return (at or datetime.now(timezone.utc)).astimezone(timezone.utc).isoformat(timespec="seconds")


def _stamped(fields: dict, by: str, note: str | None) -> dict:
    fields = {**fields, "updatedBy": by, "updatedAt": stamp()}
    if note:
        fields["note"] = note
    return fields


def _existing(ice_id: str) -> dict:
    ice = db.get_ice(ice_id)
    if ice is None:
        raise NotFoundError(f"no ice {ice_id}", field="iceId")
    return ice


def add(week: int, roster: int, note: str, by: str) -> dict:
    prefix = f"W{week:02d}#R{roster:02d}#ADMIN"
    n = 1 + sum(1 for i in db.season_ices() if i["iceId"].startswith(prefix))
    ice = {"id": f"{prefix}{n}", "week": week, "rosterId": roster, "reason": "admin"}
    if not db.put_ice(_stamped(ice, by, note), stamp(), source="admin"):
        raise ConflictError(f"{ice['id']} already exists")
    return db.get_ice(ice["id"])


def void(ice_id: str, note: str, by: str) -> dict:
    _existing(ice_id)
    return db.update_ice(ice_id, _stamped({"status": "voided"}, by, note))


def set_completed(
    ice_id: str, completed: bool, at: datetime | None, by: str, note: str | None = None
) -> dict:
    if at is not None and (at.tzinfo is None or at > datetime.now(timezone.utc)):
        raise ValidationError("at needs a UTC offset and must not be in the future", field="at")
    # Completing or undoing a voided ice would quietly bring it back as owed.
    if _existing(ice_id)["status"] == "voided":
        raise ConflictError(f"{ice_id} is voided")
    if not completed:
        fields = _stamped({"status": "owed"}, by, note)
        return db.update_ice(ice_id, fields, remove=("completedAt",))
    fields = {"status": "completed", "completedAt": stamp(at)}
    return db.update_ice(ice_id, _stamped(fields, by, note))


def chug_seconds(value: object) -> float:
    """Seconds rounded half-up to a tenth, from the decimal as typed: 9.45 is 9.5, though the float is 9.4499."""
    # bool is an int subclass, so True would otherwise pass as 1.
    if type(value) in (int, float):
        rounded = float(Decimal(str(value)).quantize(Decimal("0.1"), ROUND_HALF_UP))
        if 0 < rounded < MAX_CHUG_SECONDS:
            return rounded
    raise ValidationError(f"seconds must be a number above 0 and under {MAX_CHUG_SECONDS}", field="seconds")


def chugger(value: object) -> dict:
    """An admin's pick: a league user by sub, named from their profile, or free text for anyone else."""
    if isinstance(value, dict) and isinstance(value.get("sub"), str):
        profile = get_profile(value["sub"])
        if profile and profile["name"]:
            return {"sub": value["sub"], "name": profile["name"]}
    elif isinstance(value, dict) and "sub" not in value and isinstance(value.get("name"), str):
        name = value["name"].strip()
        if 0 < len(name) <= MAX_CHUGGER_NAME:
            return {"name": name}
    raise ValidationError(
        f"chugger must be a league user's sub or a name of 1-{MAX_CHUGGER_NAME} characters", field="chugger"
    )


def set_chug(
    ice_id: str, seconds: float, chugger: dict | None, sub: str, by: str, note: str | None = None
) -> dict:
    """No chugger keeps the one on record, so an admin fixing a time keeps who chugged it."""
    if _existing(ice_id)["status"] == "voided":
        raise ConflictError(f"{ice_id} is voided")
    fields = {"chugSeconds": seconds, "timedBy": sub, "timedAt": stamp()}
    if chugger:
        fields["chugger"] = chugger
    return db.update_ice(ice_id, _stamped(fields, by, note))


def set_setting(key: str, fields: dict, by: str, note: str | None = None) -> dict:
    return db.update_setting(key, _stamped(fields, by, note))
