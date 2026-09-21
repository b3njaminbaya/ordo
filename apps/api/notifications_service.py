"""Creating notifications and the scheduled deadline check."""
import math
from datetime import timedelta

import structlog
from sqlalchemy.exc import IntegrityError

from models import db, Notification, Task, TaskReminder, User
from validation import utcnow_naive

logger = structlog.get_logger()

# (label, lower_exclusive, upper_inclusive) — non-overlapping bands so a task
# gets at most one "upcoming" reminder type per band.
REMINDER_WINDOWS = [
    ("1h",  timedelta(0),       timedelta(hours=1)),
    ("24h", timedelta(hours=1), timedelta(hours=24)),
]


def send_notification(user_id, message, task_id=None, respect_preference=True):
    """Persist a notification and push it to the user's live sockets.

    Returns False if the user has switched notifications off (or doesn't exist).
    """
    user = db.session.get(User, user_id)
    if user is None or (respect_preference and user.notifications_enabled is False):
        return False

    notification = Notification(user_id=user_id, message=message, task_id=task_id)
    db.session.add(notification)
    db.session.commit()

    try:
        from views.realtime import emit_notification
        emit_notification(user_id, {
            "id": notification.id,
            "message": message,
            "task_id": task_id,
            "is_read": False,
            "created_at": notification.created_at.isoformat() if notification.created_at else None,
        })
    except Exception:  # noqa: BLE001 — a dead socket must never fail the request
        logger.warning("notification_push_failed", user_id=user_id)
    return True


def _message(reminder_type, task, now):
    if reminder_type == "overdue":
        return f"⚠️ Task '{task.title}' is overdue!"
    remaining = task.due_date - now
    if remaining <= timedelta(hours=1):
        return f"⏰ Task '{task.title}' is due within the hour!"
    hours = math.ceil(remaining.total_seconds() / 3600)
    return f"📅 Task '{task.title}' is due in about {hours} hours."


def _claim(task_id, user_id, reminder_type):
    """Record the reminder before sending. False means another worker already did."""
    db.session.add(TaskReminder(task_id=task_id, user_id=user_id, reminder_type=reminder_type))
    try:
        db.session.commit()
        return True
    except IntegrityError:
        db.session.rollback()
        return False


def _fire_for_task(task, reminder_type, now):
    """Remind the list owner and every assignee (who hasn't opted out) exactly once."""
    recipients = {task.tasklist.user_id} | {a.user_id for a in task.assignments}
    for uid in recipients:
        user = db.session.get(User, uid)
        if not user or user.notifications_enabled is False:
            continue
        if not _claim(task.id, uid, reminder_type):
            continue
        send_notification(uid, _message(reminder_type, task, now), task_id=task.id)
        logger.info("deadline_notification_sent", task_id=task.id, user_id=uid, type=reminder_type)


def check_task_deadlines():
    """Scheduled job: upcoming-deadline reminders and overdue alerts."""
    now = utcnow_naive()

    for label, lower, upper in REMINDER_WINDOWS:
        upcoming = Task.query.filter(
            Task.due_date > now + lower,
            Task.due_date <= now + upper,
            Task.status != "completed",
            Task.parent_task_id.is_(None),
        ).all()
        for task in upcoming:
            _fire_for_task(task, label, now)

    overdue = Task.query.filter(
        Task.due_date < now,
        Task.status != "completed",
        Task.parent_task_id.is_(None),
    ).all()
    for task in overdue:
        _fire_for_task(task, "overdue", now)

    logger.info("deadline_check_complete", checked_at=now.isoformat())
