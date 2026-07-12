from flask import Blueprint, request, jsonify, Response
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, TimeEntry, Task, TaskList, User
from datetime import datetime, timezone, timedelta
import csv
import io

time_entries_bp = Blueprint("time_entries_bp", __name__)

VALID_CATEGORIES = {"focus", "meeting", "review", "other"}


def _utcnow():
    """Naive UTC datetime — consistent with what SQLAlchemy returns from db.DateTime columns."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _get_user():
    return db.session.get(User, int(get_jwt_identity()))


def _parse_dt(value, field_name):
    """Parse an ISO 8601 string to a naive UTC datetime.
    Returns (datetime, None) on success or (None, error_str) on failure.
    """
    if not value:
        return None, f"{field_name} is required"
    try:
        dt = datetime.fromisoformat(str(value))
        if dt.tzinfo is not None:
            dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
        return dt, None
    except ValueError:
        return None, f"{field_name}: use ISO 8601 format (e.g. 2026-07-12T09:00:00)"


def _resolve_attachment(data, user_id):
    """Validate task_id / tasklist_id, auto-fill tasklist from task when possible.
    Returns (task_id, tasklist_id, error_tuple_or_None).
    """
    task_id = data.get("task_id")
    tasklist_id = data.get("tasklist_id")

    if not task_id and not tasklist_id:
        return None, None, (jsonify({"error": "task_id or tasklist_id is required"}), 400)

    if task_id:
        task = db.session.get(Task, int(task_id))
        if not task:
            return None, None, (jsonify({"error": "Task not found"}), 404)
        if task.tasklist.user_id != user_id:
            return None, None, (jsonify({"error": "Task not accessible"}), 403)
        # Auto-fill the list so summary queries never need to chase through the task
        if not tasklist_id:
            tasklist_id = task.tasklist_id

    if tasklist_id:
        tl = db.session.get(TaskList, int(tasklist_id))
        if not tl:
            return None, None, (jsonify({"error": "TaskList not found"}), 404)
        if tl.user_id != user_id:
            return None, None, (jsonify({"error": "TaskList not accessible"}), 403)

    return task_id, tasklist_id, None


def _entry_dict(entry):
    list_name = None
    if entry.tasklist:
        list_name = entry.tasklist.name
    return {
        "id": entry.id,
        "user_id": entry.user_id,
        "task_id": entry.task_id,
        "task_title": entry.task.title if entry.task else None,
        "tasklist_id": entry.tasklist_id,
        "tasklist_name": list_name,
        "started_at": entry.started_at.isoformat(),
        "ended_at": entry.ended_at.isoformat() if entry.ended_at else None,
        "duration_seconds": entry.duration_seconds,
        "note": entry.note,
        "category": entry.category,
        "created_at": entry.created_at.isoformat() if entry.created_at else None,
    }


# ── Start / stop ──────────────────────────────────────────────────────────────

@time_entries_bp.route("/time-entries/start", methods=["POST"])
@jwt_required()
def start_timer():
    user = _get_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    active = TimeEntry.query.filter_by(user_id=user.id, ended_at=None).first()
    if active:
        return jsonify({
            "error": "A timer is already running. Stop it before starting a new one.",
            "active_timer": _entry_dict(active),
        }), 409

    data = request.get_json() or {}
    task_id, tasklist_id, err = _resolve_attachment(data, user.id)
    if err:
        return err

    category = data.get("category") or None
    if category and category not in VALID_CATEGORIES:
        return jsonify({"error": f"category must be one of: {', '.join(sorted(VALID_CATEGORIES))}"}), 400

    entry = TimeEntry(
        user_id=user.id,
        task_id=task_id,
        tasklist_id=tasklist_id,
        started_at=_utcnow(),
        note=(data.get("note") or "").strip() or None,
        category=category,
    )
    db.session.add(entry)
    db.session.commit()
    db.session.refresh(entry)

    result = _entry_dict(entry)
    from views.realtime import emit_timer_started
    emit_timer_started(user.id, result)

    return jsonify(result), 201


@time_entries_bp.route("/time-entries/<int:entry_id>/stop", methods=["PATCH"])
@jwt_required()
def stop_timer(entry_id):
    user = _get_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    entry = db.session.get(TimeEntry, entry_id)
    if not entry or entry.user_id != user.id:
        return jsonify({"error": "Timer not found"}), 404
    if entry.ended_at is not None:
        return jsonify({"error": "This timer has already been stopped"}), 400

    now = _utcnow()
    entry.ended_at = now
    entry.duration_seconds = int((now - entry.started_at).total_seconds())
    db.session.commit()

    result = _entry_dict(entry)
    from views.realtime import emit_timer_stopped
    emit_timer_stopped(user.id, result)

    return jsonify(result), 200


# ── Log a completed past entry ────────────────────────────────────────────────

@time_entries_bp.route("/time-entries", methods=["POST"])
@jwt_required()
def log_entry():
    user = _get_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json() or {}

    started_at, err = _parse_dt(data.get("started_at"), "started_at")
    if err:
        return jsonify({"error": err}), 400
    ended_at, err = _parse_dt(data.get("ended_at"), "ended_at")
    if err:
        return jsonify({"error": err}), 400
    if ended_at <= started_at:
        return jsonify({"error": "ended_at must be after started_at"}), 400

    category = data.get("category") or None
    if category and category not in VALID_CATEGORIES:
        return jsonify({"error": f"category must be one of: {', '.join(sorted(VALID_CATEGORIES))}"}), 400

    task_id, tasklist_id, err = _resolve_attachment(data, user.id)
    if err:
        return err

    entry = TimeEntry(
        user_id=user.id,
        task_id=task_id,
        tasklist_id=tasklist_id,
        started_at=started_at,
        ended_at=ended_at,
        duration_seconds=int((ended_at - started_at).total_seconds()),
        note=(data.get("note") or "").strip() or None,
        category=category,
    )
    db.session.add(entry)
    db.session.commit()
    db.session.refresh(entry)
    return jsonify(_entry_dict(entry)), 201


# ── Read ──────────────────────────────────────────────────────────────────────

@time_entries_bp.route("/time-entries/active", methods=["GET"])
@jwt_required()
def get_active():
    user = _get_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    active = TimeEntry.query.filter_by(user_id=user.id, ended_at=None).first()
    return jsonify(_entry_dict(active) if active else None), 200


@time_entries_bp.route("/time-entries", methods=["GET"])
@jwt_required()
def list_entries():
    user = _get_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    query = TimeEntry.query.filter_by(user_id=user.id)

    if start := request.args.get("start"):
        try:
            query = query.filter(TimeEntry.started_at >= datetime.fromisoformat(start).replace(tzinfo=None))
        except ValueError:
            return jsonify({"error": "Invalid start date"}), 400

    if end := request.args.get("end"):
        try:
            query = query.filter(TimeEntry.started_at <= datetime.fromisoformat(end).replace(tzinfo=None))
        except ValueError:
            return jsonify({"error": "Invalid end date"}), 400

    if task_id := request.args.get("task_id"):
        query = query.filter(TimeEntry.task_id == int(task_id))

    if tasklist_id := request.args.get("tasklist_id"):
        query = query.filter(TimeEntry.tasklist_id == int(tasklist_id))

    entries = query.order_by(TimeEntry.started_at.desc()).all()
    return jsonify([_entry_dict(e) for e in entries]), 200


@time_entries_bp.route("/time-entries/summary", methods=["GET"])
@jwt_required()
def get_summary():
    user = _get_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    now = _utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())  # Monday

    completed = TimeEntry.query.filter(
        TimeEntry.user_id == user.id,
        TimeEntry.ended_at.isnot(None),
    )

    today_secs = sum(
        e.duration_seconds or 0
        for e in completed.filter(TimeEntry.started_at >= today_start).all()
    )

    week_entries = completed.filter(TimeEntry.started_at >= week_start).all()
    week_secs = sum(e.duration_seconds or 0 for e in week_entries)

    # Per-day breakdown — last 7 days
    by_day = []
    for i in range(6, -1, -1):
        day_start = today_start - timedelta(days=i)
        day_end = day_start + timedelta(days=1)
        secs = sum(
            e.duration_seconds or 0
            for e in completed.filter(
                TimeEntry.started_at >= day_start,
                TimeEntry.started_at < day_end,
            ).all()
        )
        by_day.append({
            "date": day_start.strftime("%Y-%m-%d"),
            "label": day_start.strftime("%a"),
            "seconds": secs,
        })

    # Per-list breakdown — this week
    list_totals: dict = {}
    for e in week_entries:
        name = e.tasklist.name if e.tasklist else "Unassigned"
        key = (e.tasklist_id, name)
        list_totals[key] = list_totals.get(key, 0) + (e.duration_seconds or 0)

    by_list = sorted(
        [{"tasklist_id": k[0], "name": k[1], "seconds": v} for k, v in list_totals.items()],
        key=lambda x: x["seconds"],
        reverse=True,
    )

    return jsonify({
        "today_seconds": today_secs,
        "week_seconds": week_secs,
        "by_day": by_day,
        "by_list": by_list,
    }), 200


# ── Edit / delete ─────────────────────────────────────────────────────────────

@time_entries_bp.route("/time-entries/<int:entry_id>", methods=["PATCH"])
@jwt_required()
def edit_entry(entry_id):
    user = _get_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    entry = db.session.get(TimeEntry, entry_id)
    if not entry or entry.user_id != user.id:
        return jsonify({"error": "Time entry not found"}), 404

    data = request.get_json() or {}
    is_running = entry.ended_at is None

    # note and category are editable on both running and completed entries
    if "note" in data:
        entry.note = (data["note"] or "").strip() or None
    if "category" in data:
        cat = data["category"] or None
        if cat and cat not in VALID_CATEGORIES:
            return jsonify({"error": f"category must be one of: {', '.join(sorted(VALID_CATEGORIES))}"}), 400
        entry.category = cat

    # Attachment (task / list) editable on both — useful when started on wrong item
    if "task_id" in data or "tasklist_id" in data:
        merged = {
            "task_id": data.get("task_id", entry.task_id),
            "tasklist_id": data.get("tasklist_id", entry.tasklist_id),
        }
        task_id, tasklist_id, err = _resolve_attachment(merged, user.id)
        if err:
            return err
        entry.task_id = task_id
        entry.tasklist_id = tasklist_id

    # Timestamps only editable on completed entries
    if "started_at" in data or "ended_at" in data:
        if is_running:
            return jsonify({"error": "Cannot edit timestamps on a running timer — stop it first"}), 400
        new_started = entry.started_at
        new_ended = entry.ended_at
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
        entry.started_at = new_started
        entry.ended_at = new_ended
        entry.duration_seconds = int((new_ended - new_started).total_seconds())

    db.session.commit()
    return jsonify(_entry_dict(entry)), 200


@time_entries_bp.route("/time-entries/<int:entry_id>", methods=["DELETE"])
@jwt_required()
def delete_entry(entry_id):
    user = _get_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    entry = db.session.get(TimeEntry, entry_id)
    if not entry or entry.user_id != user.id:
        return jsonify({"error": "Time entry not found"}), 404

    db.session.delete(entry)
    db.session.commit()
    return jsonify({"message": "Deleted"}), 200


# ── Export ────────────────────────────────────────────────────────────────────

@time_entries_bp.route("/time-entries/export.csv", methods=["GET"])
@jwt_required()
def export_csv():
    user = _get_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

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
        writer.writerow([
            e.started_at.strftime("%Y-%m-%d"),
            e.started_at.strftime("%H:%M"),
            e.ended_at.strftime("%H:%M"),
            round((e.duration_seconds or 0) / 60, 1),
            e.task.title if e.task else "",
            e.tasklist.name if e.tasklist else "",
            e.category or "",
            e.note or "",
        ])

    return Response(
        buf.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment; filename=time-entries-{user.username}.csv"},
    )
