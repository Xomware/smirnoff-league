"""
Admin edits to smirnoff-ices and smirnoff-settings, shared by the /admin/*
Lambdas and scripts/ice_admin.py.

Every write stamps updatedBy and updatedAt. Late rows are left alone:
late.reconcile brings them in line with completedAt on the next cron tick.
"""

from __future__ import annotations

from datetime import datetime, timezone

from lambdas.common import ices_dynamo as db
from lambdas.common.api import ConflictError, NotFoundError, ValidationError


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


def set_chug(ice_id: str, seconds: float, by: str, note: str | None = None) -> dict:
    _existing(ice_id)
    return db.update_ice(ice_id, _stamped({"chugSeconds": seconds}, by, note))


def set_setting(key: str, fields: dict, by: str, note: str | None = None) -> dict:
    return db.update_setting(key, _stamped(fields, by, note))
