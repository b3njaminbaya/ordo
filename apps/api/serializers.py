"""JSON shapes shared by REST responses and Socket.IO payloads."""
from sqlalchemy import case, func

from models import db, Task, TaskAttachment, Comment


def iso(dt):
    """Naive-UTC datetimes stored in the DB, rendered as ISO-8601 without a zone."""
    return dt.isoformat() if dt else None


def iso_utc(dt):
    """Same, but explicitly marked UTC ('Z') so browsers convert to local time."""
    return dt.isoformat() + "Z" if dt else None


def task_counts(task_ids):
    """{task_id: {subtask_count, subtasks_completed, attachment_count, comment_count}}."""
    counts = {
        tid: {"subtask_count": 0, "subtasks_completed": 0, "attachment_count": 0, "comment_count": 0}
        for tid in task_ids
    }
    if not counts:
        return counts

    ids = list(counts)
    subs = (
        db.session.query(
            Task.parent_task_id,
            func.count(Task.id),
            func.sum(case((Task.status == "completed", 1), else_=0)),
        )
        .filter(Task.parent_task_id.in_(ids))
        .group_by(Task.parent_task_id)
        .all()
    )
    for parent_id, total, done in subs:
        counts[parent_id]["subtask_count"] = int(total or 0)
        counts[parent_id]["subtasks_completed"] = int(done or 0)

    for task_id, n in (
        db.session.query(TaskAttachment.task_id, func.count(TaskAttachment.id))
        .filter(TaskAttachment.task_id.in_(ids))
        .group_by(TaskAttachment.task_id)
    ):
        counts[task_id]["attachment_count"] = int(n)

    for task_id, n in (
        db.session.query(Comment.task_id, func.count(Comment.id))
        .filter(Comment.task_id.in_(ids))
        .group_by(Comment.task_id)
    ):
        counts[task_id]["comment_count"] = int(n)

    return counts


def serialize_task(task, counts=None):
    if counts is None:
        counts = task_counts([task.id]).get(task.id, {})
    assignments = [
        {"user_id": a.user_id, "username": a.user.username if a.user else None}
        for a in task.assignments
    ]
    tasklist = task.tasklist
    return {
        "id": task.id,
        "title": task.title,
        "description": task.description,
        "due_date": iso(task.due_date),
        "priority": task.priority,
        "status": task.status,
        "position": task.position,
        "list_position": task.list_position,
        "created_at": iso(task.created_at),
        "updated_at": iso(task.updated_at),
        "completed_at": iso(task.completed_at),
        "tasklist_id": task.tasklist_id,
        "tasklist_name": tasklist.name if tasklist else None,
        "tasklist_owner_id": tasklist.user_id if tasklist else None,
        "parent_task_id": task.parent_task_id,
        # Two shapes kept for the two clients that grew up around them.
        "assignments": assignments,
        "assignees": [{"id": a["user_id"], "username": a["username"]} for a in assignments],
        "subtask_count": counts.get("subtask_count", 0),
        "subtasks_completed": counts.get("subtasks_completed", 0),
        "attachment_count": counts.get("attachment_count", 0),
        "comment_count": counts.get("comment_count", 0),
    }


def serialize_tasks(tasks):
    counts = task_counts([t.id for t in tasks])
    return [serialize_task(t, counts.get(t.id)) for t in tasks]
