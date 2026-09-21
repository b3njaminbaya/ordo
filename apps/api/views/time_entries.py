import csv
import io
import re
from datetime import datetime, timedelta, timezone

from flask import Blueprint, Response, jsonify, request
from flask_jwt_extended import jwt_required
from sqlalchemy.exc import IntegrityError

from access import can_access_task, can_access_tasklist, current_user
from models import db, Task, TaskList, TimeEntry
from serializers import iso_utc
from validation import json_body, to_int, utcnow_naive

time_entries_bp = Blueprint("time_entries_bp", __name__)

VALID_CATEGORIES = {"focus", "meeting", "review", "other"}
MAX_TZ_OFFSET_MINUTES = 14 * 60
DEFAULT_LIMIT, MAX_LIMIT = 100, 500

# All timestamps are stored as naive UTC and returned with a trailing "Z" so
# browsers convert them to the viewer's local time. Timestamps sent WITHOUT a
# zone are treated as UTC; clients should send full ISO strings (toISOString()).


def _parse_dt(value, field_name):
    """Parse an ISO 8601 string to a naive UTC datetime → (datetime, None) or (None, error)."""
    if not value or not isinstance(value, str):
        return None, f"{field_name} is required"
    try:
        dt = datetime.fromisoformat(value.strip())
    except ValueError:
        return None, f"{field_name}: use ISO 8601 format (e.g. 2026-07-12T09:00:00Z)"
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt, None


def _tz_offset():
    """Minutes east of UTC from ?tz_offset= (clamped), as a timedelta."""
    minutes = to_int(request.args.get("tz_offset")) or 0
    minutes = max(-MAX_TZ_OFFSET_MINUTES, min(MAX_TZ_OFFSET_MINUTES, minutes))
    return timedelta(minutes=minutes)


def _resolve_attachment(data, user):
    """Validate task_id / tasklist_id and auto-fill the list from the task.
    Returns (task_id, tasklist_id, error_response_or_None)."""
    raw_task, raw_list = data.get("task_id"), data.get("tasklist_id")
    task_id = to_int(raw_task) if raw_task not in (None, "") else None
    tasklist_id = to_int(raw_list) if raw_list not in (None, "") else None

    if (raw_task not in (None, "") and task_id is None) or (raw_list not in (None, "") and tasklist_id is None):
        return None, None, (jsonify({"error": "task_id and tasklist_id must be numbers"}), 400)
    if not task_id and not tasklist_id:
        return None, None, (jsonify({"error": "task_id or tasklist_id is required"}), 400)

    task = None
    if task_id:
        task = db.session.get(Task, task_id)
        if not can_access_task(user, task):
            return None, None, (jsonify({"error": "Task not found"}), 404)
        if not tasklist_id:
            tasklist_id = task.tasklist_id

    tasklist = db.session.get(TaskList, tasklist_id)
    if not can_access_tasklist(user, tasklist):
        return None, None, (jsonify({"error": "TaskList not found"}), 404)
    if task is not None and task.tasklist_id != tasklist_id:
        return None, None, (jsonify({"error": "That task is not in the selected list"}), 400)

    return task_id, tasklist_id, None


def _entry_dict(entry):
    return {
        "id": entry.id,
        "user_id": entry.user_id,
        "task_id": entry.task_id,
        "task_title": entry.task.title if entry.task else None,
        "tasklist_id": entry.tasklist_id,
        "tasklist_name": entry.tasklist.name if entry.tasklist else None,
        "started_at": iso_utc(entry.started_at),
        "ended_at": iso_utc(entry.ended_at),
        "duration_seconds": entry.duration_seconds,
        "note": entry.note,
        "category": entry.category,
        "created_at": iso_utc(entry.created_at),
    }


def _clean_note(value):
    return (value.strip()[:300] or None) if isinstance(value, str) else None


def _valid_category(value):
    """(category|None, error|None)."""
    value = value or None
    if value and value not in VALID_CATEGORIES:
        return None, f"category must be one of: {', '.join(sorted(VALID_CATEGORIES))}"
    return value, None


# ── Start / stop ──────────────────────────────────────────────────────────────

@time_entries_bp.route("/time-entries/start", methods=["POST"])
@jwt_required()
def start_timer():
    user = current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    active = TimeEntry.query.filter_by(user_id=user.id, ended_at=None).first()
    if active:
        return jsonify({
            "error": "A timer is already running. Stop it before starting a new one.",
            "active_timer": _entry_dict(active),
        }), 409

    data = json_body()
    task_id, tasklist_id, err = _resolve_attachment(data, user)
    if err:
        return err
    category, cat_err = _valid_category(data.get("category"))
    if cat_err:
        return jsonify({"error": cat_err}), 400

    entry = TimeEntry(
        user_id=user.id, task_id=task_id, tasklist_id=tasklist_id,
        started_at=utcnow_naive(), note=_clean_note(data.get("note")), category=category,
    )
    db.session.add(entry)
    try:
        db.session.commit()
    except IntegrityError:
        # Two requests raced; the database allows only one running timer per user.
        db.session.rollback()
        active = TimeEntry.query.filter_by(user_id=user.id, ended_at=None).first()
        return jsonify({
            "error": "A timer is already running. Stop it before starting a new one.",
            "active_timer": _entry_dict(active) if active else None,
        }), 409
    db.session.refresh(entry)

    result = _entry_dict(entry)
    from views.realtime import emit_timer_started
    emit_timer_started(user.id, result)
    return jsonify(result), 201


@time_entries_bp.route("/time-entries/<int:entry_id>/stop", methods=["PATCH"])
@jwt_required()
def stop_timer(entry_id):
    user = current_user()
    entry = db.session.get(TimeEntry, entry_id)
    if not user or not entry or entry.user_id != user.id:
        return jsonify({"error": "Timer not found"}), 404
    if entry.ended_at is not None:
        return jsonify({"error": "This timer has already been stopped"}), 400

    now = utcnow_naive()
    entry.ended_at = now
    entry.duration_seconds = max(0, int((now - entry.started_at).total_seconds()))
    db.session.commit()

    result = _entry_dict(entry)
    from views.realtime import emit_timer_stopped
    emit_timer_stopped(user.id, result)
    return jsonify(result), 200


# ── Log a completed past entry ────────────────────────────────────────────────

@time_entries_bp.route("/time-entries", methods=["POST"])
@jwt_required()
def log_entry():
    user = current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = json_body()
    started_at, err = _parse_dt(data.get("started_at"), "started_at")
    if err:
        return jsonify({"error": err}), 400
    ended_at, err = _parse_dt(data.get("ended_at"), "ended_at")
    if err:
        return jsonify({"error": err}), 400
    if ended_at <= started_at:
        return jsonify({"error": "ended_at must be after started_at"}), 400
    if ended_at > utcnow_naive() + timedelta(minutes=5):
        return jsonify({"error": "You can't log time in the future"}), 400

    category, cat_err = _valid_category(data.get("category"))
    if cat_err:
        return jsonify({"error": cat_err}), 400
    task_id, tasklist_id, err = _resolve_attachment(data, user)
    if err:
        return err

    entry = TimeEntry(
        user_id=user.id, task_id=task_id, tasklist_id=tasklist_id,
        started_at=started_at, ended_at=ended_at,
        duration_seconds=int((ended_at - started_at).total_seconds()),
        note=_clean_note(data.get("note")), category=category,
    )
    db.session.add(entry)
    db.session.commit()
    db.session.refresh(entry)
    return jsonify(_entry_dict(entry)), 201


# ── Read ──────────────────────────────────────────────────────────────────────

@time_entries_bp.route("/time-entries/active", methods=["GET"])
@jwt_required()
def get_active():
    user = current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404
    active = TimeEntry.query.filter_by(user_id=user.id, ended_at=None).first()
    return jsonify(_entry_dict(active) if active else None), 200


@time_entries_bp.route("/time-entries", methods=["GET"])
@jwt_required()
def list_entries():
    user = current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    query = TimeEntry.query.filter_by(user_id=user.id)

    for arg, op in (("start", TimeEntry.started_at.__ge__), ("end", TimeEntry.started_at.__le__)):
        if raw := request.args.get(arg):
            dt, err = _parse_dt(raw, arg)
            if err:
                return jsonify({"error": f"Invalid {arg} date"}), 400
            query = query.filter(op(dt))

    for arg, col in (("task_id", TimeEntry.task_id), ("tasklist_id", TimeEntry.tasklist_id)):
        if raw := request.args.get(arg):
            value = to_int(raw)
            if value is None:
                return jsonify({"error": f"Invalid {arg}"}), 400
            query = query.filter(col == value)

    limit = max(1, min(request.args.get("limit", DEFAULT_LIMIT, type=int), MAX_LIMIT))
    entries = query.order_by(TimeEntry.started_at.desc(), TimeEntry.id.desc()).limit(limit).all()
    return jsonify([_entry_dict(e) for e in entries]), 200


@time_entries_bp.route("/time-entries/summary", methods=["GET"])
@jwt_required()
def get_summary():
    """Totals for today / this week / the last 7 days, in the caller's timezone
    (pass ?tz_offset=<minutes east of UTC>)."""
    user = current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    offset = _tz_offset()
    now_local = utcnow_naive() + offset
    today_local = now_local.replace(hour=0, minute=0, second=0, microsecond=0)
    today_start = today_local - offset                                # in UTC
    week_start = today_start - timedelta(days=today_local.weekday())  # Monday

    completed = TimeEntry.query.filter(TimeEntry.user_id == user.id, TimeEntry.ended_at.isnot(None))

    def seconds_between(start, end=None):
        q = completed.filter(TimeEntry.started_at >= start)
        if end is not None:
            q = q.filter(TimeEntry.started_at < end)
        return sum(e.duration_seconds or 0 for e in q.all())

    week_entries = completed.filter(TimeEntry.started_at >= week_start).all()

    by_day = []
    for i in range(6, -1, -1):
        day_start = today_start - timedelta(days=i)
        local_day = day_start + offset
        by_day.append({
            "date": local_day.strftime("%Y-%m-%d"),
            "label": local_day.strftime("%a"),
            "seconds": seconds_between(day_start, day_start + timedelta(days=1)),
        })

    list_totals: dict = {}
    for e in week_entries:
        key = (e.tasklist_id, e.tasklist.name if e.tasklist else "Unassigned")
        list_totals[key] = list_totals.get(key, 0) + (e.duration_seconds or 0)

    return jsonify({
        "today_seconds": seconds_between(today_start),
        "week_seconds": sum(e.duration_seconds or 0 for e in week_entries),
        "by_day": by_day,
        "by_list": sorted(
            [{"tasklist_id": k[0], "name": k[1], "seconds": v} for k, v in list_totals.items()],
            key=lambda x: x["seconds"], reverse=True,
        ),
    }), 200


# ── Edit / delete ─────────────────────────────────────────────────────────────

@time_entries_bp.route("/time-entries/<int:entry_id>", methods=["PATCH"])
@jwt_required()
def edit_entry(entry_id):
    user = current_user()
    entry = db.session.get(TimeEntry, entry_id)
    if not user or not entry or entry.user_id != user.id:
        return jsonify({"error": "Time entry not found"}), 404

    data = json_body()
    is_running = entry.ended_at is None

    if "note" in data:
        entry.note = _clean_note(data["note"])
    if "category" in data:
        category, err = _valid_category(data["category"])
        if err:
            return jsonify({"error": err}), 400
        entry.category = category

    if "task_id" in data or "tasklist_id" in data:
        merged = {
            "task_id": data.get("task_id", entry.task_id),
            "tasklist_id": data.get("tasklist_id", entry.tasklist_id),
        }
        # Moving to another list while keeping a task from the old one would be inconsistent.
        if "tasklist_id" in data and "task_id" not in data and to_int(data["tasklist_id"]) != entry.tasklist_id:
            merged["task_id"] = None
        task_id, tasklist_id, err = _resolve_attachment(merged, user)
        if err:
            return err
        entry.task_id, entry.tasklist_id = task_id, tasklist_id

    if "started_at" in data or "ended_at" in data:
        if is_running:
            return jsonify({"error": "Cannot edit timestamps on a running timer — stop it first"}), 400
        new_started, new_ended = entry.started_at, entry.ended_at
        if "started_at" in data:
            new_started, err = _parse_dt(data["started_at"], "started_at")
            if err:
                return jsonify({"error": err}), 400
        if "ended_at" in data:
            new_ended, err = _parse_dt(data["ended_at"], "ended_at")
            if err:
                return jsonify({"error": err}), 400
        if new_ended <= new_started:
            return jsonify({"error": "ended_at must be after started_at"}), 400
        entry.started_at, entry.ended_at = new_started, new_ended
        entry.duration_seconds = int((new_ended - new_started).total_seconds())

    db.session.commit()
    return jsonify(_entry_dict(entry)), 200


@time_entries_bp.route("/time-entries/<int:entry_id>", methods=["DELETE"])
@jwt_required()
def delete_entry(entry_id):
    user = current_user()
    entry = db.session.get(TimeEntry, entry_id)
    if not user or not entry or entry.user_id != user.id:
        return jsonify({"error": "Time entry not found"}), 404

    was_running = entry.ended_at is None
    db.session.delete(entry)
    db.session.commit()
    if was_running:
        from views.realtime import emit_timer_stopped
        emit_timer_stopped(user.id, {"id": entry_id, "deleted": True})
    return jsonify({"message": "Deleted"}), 200


# ── Export ────────────────────────────────────────────────────────────────────

_FORMULA_START = re.compile(r"^[=+\-@\t\r]")


def _csv_safe(value):
    """Stop spreadsheet apps from executing user text that looks like a formula."""
    value = value or ""
    return "'" + value if _FORMULA_START.match(value) else value


@time_entries_bp.route("/time-entries/export.csv", methods=["GET"])
@jwt_required()
def export_csv():
    user = current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    offset = _tz_offset()
    entries = (
        TimeEntry.query
        .filter(TimeEntry.user_id == user.id, TimeEntry.ended_at.isnot(None))
        .order_by(TimeEntry.started_at.desc())
        .all()
    )

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["Date", "Start", "End", "Duration (min)", "Task", "List", "Category", "Note"])
    for e in entries:
        start, end = e.started_at + offset, e.ended_at + offset
        writer.writerow([
            start.strftime("%Y-%m-%d"),
            start.strftime("%H:%M"),
            end.strftime("%H:%M"),
            round((e.duration_seconds or 0) / 60, 1),
            _csv_safe(e.task.title if e.task else ""),
            _csv_safe(e.tasklist.name if e.tasklist else ""),
            e.category or "",
            _csv_safe(e.note),
        ])

    return Response(
        buf.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=time-entries.csv"},
    )
