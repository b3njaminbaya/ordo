from flask import Blueprint, jsonify, request
from models import db, Task, TaskList, User
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timezone, timedelta

task_stats_bp = Blueprint("task_stats_bp", __name__)


def _user_task_query(user_id):
    return Task.query.join(TaskList, Task.tasklist_id == TaskList.id).filter(TaskList.user_id == user_id)


@task_stats_bp.route("/api/task-stats", methods=["GET"])
@jwt_required()
def get_task_stats():
    user_id = int(get_jwt_identity())
    now = datetime.now(timezone.utc)
    base = _user_task_query(user_id)

    total     = base.count()
    completed = base.filter(Task.status == "completed").count()
    pending   = base.filter(Task.status == "pending").count()
    in_prog   = base.filter(Task.status == "in-progress").count()
    overdue   = base.filter(Task.due_date < now, Task.status != "completed").count()

    overdue_rate = round(overdue / total * 100, 1) if total else 0.0

    return jsonify({
        "completed":   completed,
        "pending":     pending,
        "inProgress":  in_prog,
        "overdue":     overdue,
        "total":       total,
        "overdueRate": overdue_rate,
    })


@task_stats_bp.route("/api/upcoming-tasks", methods=["GET"])
@jwt_required()
def get_upcoming_tasks():
    user_id = int(get_jwt_identity())
    now = datetime.now(timezone.utc)

    upcoming_tasks = (
        _user_task_query(user_id)
        .filter(Task.due_date >= now, Task.status != "completed")
        .order_by(Task.due_date.asc())
        .limit(5)
        .all()
    )

    return jsonify([{
        "id":      task.id,
        "title":   task.title,
        "dueDate": task.due_date.strftime("%Y-%m-%d") if task.due_date else None,
    } for task in upcoming_tasks])


@task_stats_bp.route("/api/task-stats/velocity", methods=["GET"])
@jwt_required()
def get_velocity():
    """Completed task counts per week for the last 8 weeks."""
    user_id = int(get_jwt_identity())
    now = datetime.now(timezone.utc)
    weeks = []
    for i in range(7, -1, -1):
        week_start = now - timedelta(weeks=i + 1)
        week_end   = now - timedelta(weeks=i)
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


@task_stats_bp.route("/api/task-stats/workload", methods=["GET"])
@jwt_required()
def get_workload():
    """Per-member task distribution across the workspace."""
    user_id = int(get_jwt_identity())
    me = db.session.get(User, user_id)
    if not me or not me.workspace_id:
        return jsonify([])

    now = datetime.now(timezone.utc)

    # All users in the same workspace
    members = User.query.filter_by(workspace_id=me.workspace_id).all()

    result = []
    for member in members:
        base = _user_task_query(member.id)
        total     = base.count()
        completed = base.filter(Task.status == "completed").count()
        in_prog   = base.filter(Task.status == "in-progress").count()
        overdue   = base.filter(Task.due_date < now, Task.status != "completed").count()
        result.append({
            "username":  member.username,
            "total":     total,
            "completed": completed,
            "inProgress": in_prog,
            "overdue":   overdue,
            "open":      total - completed,
        })

    result.sort(key=lambda x: x["total"], reverse=True)
    return jsonify(result)
