import calendar
from datetime import timedelta

import structlog
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required

from access import can_access_tasklist, current_user, workspace_id_for_owner
from models import db, RecurringTask, Task, TaskList
from validation import VALID_PRIORITIES, json_body, to_int, utcnow_naive

logger = structlog.get_logger()

recurring_bp = Blueprint("recurring_bp", __name__)

VALID_RULES = {"daily", "weekly", "monthly", "custom"}
MAX_INTERVAL_DAYS = 365


def _add_months(dt, months):
    month_index = dt.month - 1 + months
    year, month = dt.year + month_index // 12, month_index % 12 + 1
    day = min(dt.day, calendar.monthrange(year, month)[1])
    return dt.replace(year=year, month=month, day=day)


def _calc_next_run(from_dt, rule, interval):
    """Return the next run datetime after from_dt."""
    if rule == "daily":
        return from_dt + timedelta(days=1)
    if rule == "weekly":
        return from_dt + timedelta(weeks=1)
    if rule == "monthly":
        return _add_months(from_dt, 1)
    return from_dt + timedelta(days=max(1, interval))


def _serialize(rt):
    return {
        "id":                  rt.id,
        "title":               rt.title,
        "description":         rt.description,
        "priority":            rt.priority,
        "tasklist_id":         rt.tasklist_id,
        "tasklist_name":       rt.tasklist.name if rt.tasklist else None,
        "recurrence_rule":     rt.recurrence_rule,
        "recurrence_interval": rt.recurrence_interval,
        "next_run_at":         rt.next_run_at.isoformat() + "Z" if rt.next_run_at else None,
        "active":              rt.active,
        "created_at":          rt.created_at.isoformat() + "Z" if rt.created_at else None,
        "creator_name":        rt.creator.username if rt.creator else None,
    }


def _own(user):
    return RecurringTask.query.filter_by(created_by=user.id)


def _parse_interval(value):
    interval = to_int(value if value not in (None, "") else 1)
    if interval is None or not 1 <= interval <= MAX_INTERVAL_DAYS:
        return None
    return interval


@recurring_bp.route("/recurring-tasks", methods=["GET"])
@jwt_required()
def list_recurring():
    user = current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404
    items = _own(user).order_by(RecurringTask.created_at.desc(), RecurringTask.id.desc()).all()
    return jsonify([_serialize(r) for r in items]), 200


@recurring_bp.route("/recurring-tasks", methods=["POST"])
@jwt_required()
def create_recurring():
    user = current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = json_body()
    title = (data.get("title") or "").strip() if isinstance(data.get("title"), str) else ""
    if not title:
        return jsonify({"error": "Title is required"}), 400
    if len(title) > 100:
        return jsonify({"error": "Title must be 100 characters or fewer"}), 400

    rule = data.get("recurrence_rule", "daily")
    if rule not in VALID_RULES:
        return jsonify({"error": f"recurrence_rule must be one of: {', '.join(sorted(VALID_RULES))}"}), 400

    interval = _parse_interval(data.get("recurrence_interval"))
    if interval is None:
        return jsonify({"error": f"recurrence_interval must be between 1 and {MAX_INTERVAL_DAYS}"}), 400

    priority = data.get("priority", "medium")
    if priority not in VALID_PRIORITIES:
        return jsonify({"error": f"priority must be one of: {', '.join(sorted(VALID_PRIORITIES))}"}), 400

    tasklist_id = to_int(data.get("tasklist_id"))
    if tasklist_id:
        tl = db.session.get(TaskList, tasklist_id)
        if not can_access_tasklist(user, tl):
            return jsonify({"error": "TaskList not found"}), 404
    else:
        tl = TaskList.query.filter_by(user_id=user.id).order_by(TaskList.id).first()
        if not tl:
            return jsonify({"error": "Create a task list first"}), 404

    description = data.get("description")
    description = description.strip() or None if isinstance(description, str) else None

    rt = RecurringTask(
        title=title,
        description=description,
        priority=priority,
        tasklist_id=tl.id,
        created_by=user.id,
        recurrence_rule=rule,
        recurrence_interval=interval,
        next_run_at=_calc_next_run(utcnow_naive(), rule, interval),  # first run is one period from now
        active=True,
    )
    db.session.add(rt)
    db.session.commit()

    logger.info("recurring_task_created", id=rt.id, rule=rule, user_id=user.id)
    return jsonify(_serialize(rt)), 201


@recurring_bp.route("/recurring-tasks/<int:rt_id>", methods=["PATCH"])
@jwt_required()
def update_recurring(rt_id):
    user = current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404
    rt = _own(user).filter_by(id=rt_id).first()
    if not rt:
        return jsonify({"error": "Recurring task not found"}), 404

    data = json_body()

    if "title" in data:
        title = data["title"].strip() if isinstance(data["title"], str) else ""
        if not title or len(title) > 100:
            return jsonify({"error": "Title must be 1–100 characters"}), 400
        rt.title = title

    if "description" in data:
        d = data["description"]
        if d is not None and not isinstance(d, str):
            return jsonify({"error": "Invalid description"}), 400
        rt.description = (d or "").strip() or None

    if "priority" in data:
        if data["priority"] not in VALID_PRIORITIES:
            return jsonify({"error": f"priority must be one of: {', '.join(sorted(VALID_PRIORITIES))}"}), 400
        rt.priority = data["priority"]

    if "tasklist_id" in data and to_int(data["tasklist_id"]) not in (None, rt.tasklist_id):
        tl = db.session.get(TaskList, to_int(data["tasklist_id"]))
        if not can_access_tasklist(user, tl):
            return jsonify({"error": "TaskList not found"}), 404
        rt.tasklist_id = tl.id

    schedule_changed = False
    if "recurrence_rule" in data:
        if data["recurrence_rule"] not in VALID_RULES:
            return jsonify({"error": f"recurrence_rule must be one of: {', '.join(sorted(VALID_RULES))}"}), 400
        schedule_changed |= data["recurrence_rule"] != rt.recurrence_rule
        rt.recurrence_rule = data["recurrence_rule"]

    if "recurrence_interval" in data:
        interval = _parse_interval(data["recurrence_interval"])
        if interval is None:
            return jsonify({"error": f"recurrence_interval must be between 1 and {MAX_INTERVAL_DAYS}"}), 400
        schedule_changed |= interval != rt.recurrence_interval
        rt.recurrence_interval = interval

    if "active" in data:
        if not isinstance(data["active"], bool):
            return jsonify({"error": "active must be true or false"}), 400
        if data["active"] and not rt.active:
            # Resuming: schedule from now rather than firing for the whole paused period.
            schedule_changed = True
        rt.active = data["active"]

    if schedule_changed:
        rt.next_run_at = _calc_next_run(utcnow_naive(), rt.recurrence_rule, rt.recurrence_interval)

    db.session.commit()
    return jsonify(_serialize(rt)), 200


@recurring_bp.route("/recurring-tasks/<int:rt_id>", methods=["DELETE"])
@jwt_required()
def delete_recurring(rt_id):
    user = current_user()
    rt = _own(user).filter_by(id=rt_id).first() if user else None
    if not rt:
        return jsonify({"error": "Recurring task not found"}), 404

    db.session.delete(rt)
    db.session.commit()
    logger.info("recurring_task_deleted", id=rt_id, user_id=user.id)
    return jsonify({"message": "Deleted"}), 200


# ── Scheduler job ─────────────────────────────────────────────────────────────

def spawn_recurring_tasks():
    """Create one task for every active template that is due.

    The claim on `next_run_at` is a compare-and-set UPDATE, so if several
    workers run this at once only one of them spawns each occurrence. If the
    server was down for a while, missed occurrences are skipped (one task is
    created, then the schedule jumps to the next future slot).
    """
    from views.task import next_list_position, next_position
    from serializers import serialize_task

    now = utcnow_naive()
    due = RecurringTask.query.filter(
        RecurringTask.active.is_(True), RecurringTask.next_run_at <= now,
    ).all()

    spawned = 0
    for rt in due:
        try:
            old_next = rt.next_run_at
            new_next = _calc_next_run(old_next, rt.recurrence_rule, rt.recurrence_interval)
            while new_next <= now:
                new_next = _calc_next_run(new_next, rt.recurrence_rule, rt.recurrence_interval)

            claimed = RecurringTask.query.filter(
                RecurringTask.id == rt.id, RecurringTask.next_run_at == old_next,
            ).update({"next_run_at": new_next}, synchronize_session=False)
            if not claimed:
                db.session.rollback()
                continue

            tasklist = db.session.get(TaskList, rt.tasklist_id)
            if tasklist is None:
                db.session.commit()
                continue

            task = Task(
                title=rt.title,
                description=rt.description,
                priority=rt.priority,
                status="todo",
                tasklist_id=rt.tasklist_id,
                position=next_position(tasklist.user_id, "todo"),
                list_position=next_list_position(rt.tasklist_id),
            )
            db.session.add(task)
            db.session.commit()
            spawned += 1

            ws = workspace_id_for_owner(tasklist.user_id)
            if ws:
                from views.realtime import emit_task_created
                emit_task_created(ws, serialize_task(task))
        except Exception:  # noqa: BLE001
            db.session.rollback()
            logger.exception("recurring_spawn_error", recurring_id=rt.id)

    if spawned:
        logger.info("recurring_tasks_spawned", count=spawned)
    return spawned
