import structlog
from datetime import datetime, timezone, timedelta

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from models import db, Task, TaskList, User, RecurringTask

logger = structlog.get_logger()

recurring_bp = Blueprint("recurring_bp", __name__)

VALID_RULES = {"daily", "weekly", "monthly", "custom"}


def _get_user():
    return db.session.get(User, int(get_jwt_identity()))


def _calc_next_run(from_dt, rule, interval):
    """Return the next run datetime after from_dt."""
    if rule == "daily":
        return from_dt + timedelta(days=1)
    if rule == "weekly":
        return from_dt + timedelta(weeks=1)
    if rule == "monthly":
        return from_dt + timedelta(days=30)
    # custom
    return from_dt + timedelta(days=max(1, interval))


def _serialize(rt):
    return {
        "id":                  rt.id,
        "title":               rt.title,
        "description":         rt.description,
        "priority":            rt.priority,
        "tasklist_id":         rt.tasklist_id,
        "recurrence_rule":     rt.recurrence_rule,
        "recurrence_interval": rt.recurrence_interval,
        "next_run_at":         rt.next_run_at.isoformat() if rt.next_run_at else None,
        "active":              rt.active,
        "created_at":          rt.created_at.isoformat() if rt.created_at else None,
        "creator_name":        rt.creator.username if rt.creator else None,
    }


def _user_base(user):
    """Base query: recurring tasks created by the user."""
    return RecurringTask.query.filter_by(created_by=user.id)


# ── List ──────────────────────────────────────────────────────────────────────

@recurring_bp.route("/recurring-tasks", methods=["GET"])
@jwt_required()
def list_recurring():
    user = _get_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    items = _user_base(user).order_by(RecurringTask.created_at.desc()).all()
    return jsonify([_serialize(r) for r in items]), 200


# ── Create ────────────────────────────────────────────────────────────────────

@recurring_bp.route("/recurring-tasks", methods=["POST"])
@jwt_required()
def create_recurring():
    user = _get_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json()
    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "Title is required"}), 400

    rule = data.get("recurrence_rule", "daily")
    if rule not in VALID_RULES:
        return jsonify({"error": f"recurrence_rule must be one of: {', '.join(sorted(VALID_RULES))}"}), 400

    interval = int(data.get("recurrence_interval") or 1)
    if interval < 1:
        return jsonify({"error": "recurrence_interval must be >= 1"}), 400

    tasklist_id = data.get("tasklist_id")
    if tasklist_id:
        tl = db.session.get(TaskList, tasklist_id)
        if not tl or tl.user_id != user.id:
            return jsonify({"error": "TaskList not found or not yours"}), 404
    else:
        tl = TaskList.query.filter_by(user_id=user.id).first()
        if not tl:
            return jsonify({"error": "No task list found for user"}), 404
        tasklist_id = tl.id

    # Default first run = now + interval so it doesn't fire immediately
    now = datetime.now(timezone.utc)
    next_run = _calc_next_run(now, rule, interval)

    rt = RecurringTask(
        title=title,
        description=(data.get("description") or "").strip() or None,
        priority=data.get("priority", "medium"),
        tasklist_id=tasklist_id,
        created_by=user.id,
        recurrence_rule=rule,
        recurrence_interval=interval,
        next_run_at=next_run,
        active=True,
    )
    db.session.add(rt)
    db.session.commit()

    logger.info("recurring_task_created", id=rt.id, rule=rule, user_id=user.id)
    return jsonify(_serialize(rt)), 201


# ── Update ────────────────────────────────────────────────────────────────────

@recurring_bp.route("/recurring-tasks/<int:rt_id>", methods=["PATCH"])
@jwt_required()
def update_recurring(rt_id):
    user = _get_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    rt = _user_base(user).filter_by(id=rt_id).first()
    if not rt:
        return jsonify({"error": "Recurring task not found"}), 404

    data = request.get_json()

    if "title" in data:
        title = data["title"].strip()
        if not title:
            return jsonify({"error": "Title cannot be empty"}), 400
        rt.title = title

    for field in ("description", "priority"):
        if field in data:
            setattr(rt, field, data[field])

    if "recurrence_rule" in data:
        rule = data["recurrence_rule"]
        if rule not in VALID_RULES:
            return jsonify({"error": f"recurrence_rule must be one of: {', '.join(sorted(VALID_RULES))}"}), 400
        rt.recurrence_rule = rule

    if "recurrence_interval" in data:
        interval = int(data["recurrence_interval"] or 1)
        if interval < 1:
            return jsonify({"error": "recurrence_interval must be >= 1"}), 400
        rt.recurrence_interval = interval

    if "active" in data:
        rt.active = bool(data["active"])

    db.session.commit()
    return jsonify(_serialize(rt)), 200


# ── Delete ────────────────────────────────────────────────────────────────────

@recurring_bp.route("/recurring-tasks/<int:rt_id>", methods=["DELETE"])
@jwt_required()
def delete_recurring(rt_id):
    user = _get_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    rt = _user_base(user).filter_by(id=rt_id).first()
    if not rt:
        return jsonify({"error": "Recurring task not found"}), 404

    db.session.delete(rt)
    db.session.commit()

    logger.info("recurring_task_deleted", id=rt_id, user_id=user.id)
    return jsonify({"message": "Deleted"}), 200


# ── Scheduler job ─────────────────────────────────────────────────────────────

def spawn_recurring_tasks():
    """
    Called by APScheduler hourly.
    For every active RecurringTask whose next_run_at is in the past, create a
    new Task and advance next_run_at atomically — prevents duplicate creation.
    """
    from views.task import _next_position

    now = datetime.now(timezone.utc)
    due = RecurringTask.query.filter(
        RecurringTask.active == True,       # noqa: E712
        RecurringTask.next_run_at <= now,
    ).all()

    spawned = 0
    for rt in due:
        try:
            # Advance next_run_at BEFORE committing the new task — atomic dedup
            rt.next_run_at = _calc_next_run(rt.next_run_at, rt.recurrence_rule, rt.recurrence_interval)

            owner_id = rt.tasklist.user_id if rt.tasklist else rt.created_by
            task = Task(
                title=rt.title,
                description=rt.description,
                priority=rt.priority,
                status="todo",
                tasklist_id=rt.tasklist_id,
                position=_next_position(owner_id, "todo"),
            )
            db.session.add(task)
            spawned += 1
        except Exception:  # noqa: BLE001
            logger.exception("recurring_spawn_error", recurring_id=rt.id)

    if spawned:
        db.session.commit()
        logger.info("recurring_tasks_spawned", count=spawned)
