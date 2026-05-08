from flask import Blueprint, jsonify
from models import db, Task, TaskList
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timezone, timedelta

task_stats_bp = Blueprint("task_stats_bp", __name__)

def _user_task_query(user_id):
    """Base query for tasks belonging to the current user's task lists."""
    return Task.query.join(TaskList, Task.tasklist_id == TaskList.id).filter(TaskList.user_id == user_id)


@task_stats_bp.route("/api/task-stats", methods=["GET"])
@jwt_required()
def get_task_stats():
    user_id = get_jwt_identity()
    now = datetime.now(timezone.utc)

    base = _user_task_query(user_id)

    return jsonify({
        "completed": base.filter(Task.status == "completed").count(),
        "pending": base.filter(Task.status == "pending").count(),
        "inProgress": base.filter(Task.status == "in-progress").count(),
        "overdue": base.filter(Task.due_date < now, Task.status != "completed").count(),
    })


@task_stats_bp.route("/api/upcoming-tasks", methods=["GET"])
@jwt_required()
def get_upcoming_tasks():
    user_id = get_jwt_identity()
    now = datetime.now(timezone.utc)

    upcoming_tasks = (
        _user_task_query(user_id)
        .filter(Task.due_date >= now, Task.status != "completed")
        .order_by(Task.due_date.asc())
        .limit(5)
        .all()
    )

    return jsonify([{
        "id": task.id,
        "title": task.title,
        "dueDate": task.due_date.strftime("%Y-%m-%d") if task.due_date else None,
    } for task in upcoming_tasks])


@task_stats_bp.route("/api/task-stats/velocity", methods=["GET"])
@jwt_required()
def get_velocity():
    """Return completed task counts per week for the last 8 weeks."""
    user_id = get_jwt_identity()
    now = datetime.now(timezone.utc)
    weeks = []
    for i in range(7, -1, -1):
        week_start = now - timedelta(weeks=i + 1)
        week_end = now - timedelta(weeks=i)
        count = (
            _user_task_query(user_id)
            .filter(
                Task.status == "completed",
                Task.updated_at >= week_start,
                Task.updated_at < week_end,
            )
            .count()
        )
        weeks.append({"week": week_start.strftime("%b %d"), "completed": count})
    return jsonify(weeks)

