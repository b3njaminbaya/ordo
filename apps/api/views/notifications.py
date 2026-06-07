import structlog
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Notification, User, Task, TaskReminder
from datetime import datetime, timedelta, timezone

logger = structlog.get_logger()

notifications_bp = Blueprint("notifications_bp", __name__)

# Reminder windows: (label, lower_exclusive, upper_inclusive)
# Non-overlapping bands so each task+user gets at most one upcoming-reminder type.
# Tasks due within 1 h  → "1h" reminder
# Tasks due in 1–24 h   → "24h" reminder
REMINDER_WINDOWS = [
    ("1h",  timedelta(0),       timedelta(hours=1)),
    ("24h", timedelta(hours=1), timedelta(hours=24)),
]

REMINDER_MESSAGES = {
    "24h":     "📅 Task '{title}' is due in 24 hours.",
    "1h":      "⏰ Task '{title}' is due within the hour!",
    "overdue": "⚠️ Task '{title}' is overdue!",
}


def _get_user():
    return db.session.get(User, int(get_jwt_identity()))


def send_notification(user_id, message, task_id=None):
    """Creates a persisted Notification row and pushes it via Socket.IO."""
    notification = Notification(user_id=user_id, message=message, task_id=task_id)
    db.session.add(notification)
    db.session.commit()

    try:
        from app import socketio
        socketio.emit(
            "notification",
            {
                "id": notification.id,
                "message": message,
                "task_id": task_id,
                "is_read": False,
                "created_at": notification.created_at.isoformat() if notification.created_at else None,
            },
            room=f"user_{user_id}",
        )
    except Exception:
        pass


def _already_sent(task_id, user_id, reminder_type):
    return db.session.query(
        db.exists().where(
            TaskReminder.task_id == task_id,
            TaskReminder.user_id == user_id,
            TaskReminder.reminder_type == reminder_type,
        )
    ).scalar()


def _record_sent(task_id, user_id, reminder_type):
    reminder = TaskReminder(task_id=task_id, user_id=user_id, reminder_type=reminder_type)
    db.session.add(reminder)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()


def _fire_for_task(task, reminder_type):
    """Send reminder to the task owner and all assignees who have notifications enabled."""
    recipients = {task.tasklist.user_id} | {a.user_id for a in task.assignments}
    for uid in recipients:
        if _already_sent(task.id, uid, reminder_type):
            continue
        user = db.session.get(User, uid)
        if not user or not user.notifications_enabled:
            continue

        msg = REMINDER_MESSAGES[reminder_type].format(title=task.title)
        send_notification(uid, msg, task_id=task.id)
        _record_sent(task.id, uid, reminder_type)
        logger.info("deadline_notification_sent", task_id=task.id, user_id=uid, type=reminder_type)


def check_task_deadlines():
    """
    Scheduled job: fires configurable-interval reminders and overdue alerts.
    Each (task, user, reminder_type) fires exactly once, preventing duplicates
    across scheduler restarts.
    """
    now = datetime.now(timezone.utc)

    # Upcoming windows: fire when due_date falls in (now + lower, now + upper]
    for label, lower, upper in REMINDER_WINDOWS:
        upcoming = Task.query.filter(
            Task.due_date > now + lower,
            Task.due_date <= now + upper,
            Task.status != "completed",
        ).all()
        for task in upcoming:
            _fire_for_task(task, label)

    # Overdue: past due and not completed
    overdue = Task.query.filter(
        Task.due_date < now,
        Task.status != "completed",
    ).all()
    for task in overdue:
        _fire_for_task(task, "overdue")

    logger.info("deadline_check_complete", checked_at=now.isoformat())


# ── REST endpoints ────────────────────────────────────────────────────────────

@notifications_bp.route("/notifications", methods=["GET"])
@jwt_required()
def get_notifications():
    user = _get_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    page     = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 10, type=int)
    paginated = (
        Notification.query
        .filter_by(user_id=user.id)
        .order_by(Notification.created_at.desc())
        .paginate(page=page, per_page=per_page, error_out=False)
    )

    return jsonify({
        "notifications": [
            {
                "id": n.id,
                "message": n.message,
                "is_read": n.is_read,
                "task_id": n.task_id,
                "created_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n in paginated.items
        ],
        "total_pages": paginated.pages,
        "current_page": paginated.page,
        "unread_count": Notification.query.filter_by(user_id=user.id, is_read=False).count(),
    })


@notifications_bp.route("/notifications/<int:notification_id>/read", methods=["PUT"])
@jwt_required()
def mark_notification_as_read(notification_id):
    user = _get_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    notification = Notification.query.filter_by(id=notification_id, user_id=user.id).first()
    if not notification:
        return jsonify({"error": "Notification not found"}), 404

    notification.is_read = True
    db.session.commit()
    return jsonify({"success": "Notification marked as read"}), 200


@notifications_bp.route("/notifications/read-all", methods=["PATCH"])
@jwt_required()
def mark_all_notifications_as_read():
    user = _get_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    Notification.query.filter_by(user_id=user.id, is_read=False).update({"is_read": True})
    db.session.commit()
    return jsonify({"message": "All notifications marked as read"}), 200


@notifications_bp.route("/notifications/<int:notification_id>", methods=["DELETE"])
@jwt_required()
def delete_notification(notification_id):
    user = _get_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    notification = Notification.query.filter_by(id=notification_id, user_id=user.id).first()
    if not notification:
        return jsonify({"error": "Notification not found"}), 404

    db.session.delete(notification)
    db.session.commit()
    return jsonify({"message": "Notification deleted successfully"}), 200


@notifications_bp.route("/notifications/settings", methods=["PATCH"])
@jwt_required()
def toggle_notifications():
    user = _get_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json()
    enabled = bool(data.get("enable_notifications", True))
    user.notifications_enabled = enabled
    db.session.commit()
    return jsonify({"message": "Notification settings updated", "enabled": enabled}), 200
