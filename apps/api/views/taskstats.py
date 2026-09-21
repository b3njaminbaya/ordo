from datetime import timedelta

from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required

from access import current_user, visible_task_query
from models import db, Task, TaskAssignment, User
from validation import utcnow_naive

task_stats_bp = Blueprint("task_stats_bp", __name__)


@task_stats_bp.route("/api/task-stats", methods=["GET"])
@jwt_required()
def get_task_stats():
    """Counts for every top-level task visible in the user's workspace."""
    user = current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404
    now = utcnow_naive()
    base = visible_task_query(user)

    total = base.count()
    counts = {status: base.filter(Task.status == status).count()
              for status in ("todo", "in-progress", "pending", "completed")}
    overdue = base.filter(Task.due_date < now, Task.status != "completed").count()

    return jsonify({
        "todo":        counts["todo"],
        "inProgress":  counts["in-progress"],
        "pending":     counts["pending"],      # shown as "In Review" on the board
        "completed":   counts["completed"],
        "overdue":     overdue,
        "total":       total,
        "overdueRate": round(overdue / total * 100, 1) if total else 0.0,
    })


@task_stats_bp.route("/api/upcoming-tasks", methods=["GET"])
@jwt_required()
def get_upcoming_tasks():
    user = current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404
    now = utcnow_naive()

    tasks = (
        visible_task_query(user)
        .filter(Task.due_date >= now, Task.status != "completed")
        .order_by(Task.due_date.asc())
        .limit(5)
        .all()
    )
    return jsonify([{
        "id":      t.id,
        "title":   t.title,
        "dueDate": t.due_date.strftime("%Y-%m-%d") if t.due_date else None,
    } for t in tasks])


@task_stats_bp.route("/api/task-stats/velocity", methods=["GET"])
@jwt_required()
def get_velocity():
    """Tasks completed per week for the last 8 weeks (by completion time)."""
    user = current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404
    now = utcnow_naive()
    base = visible_task_query(user).filter(Task.status == "completed")

    weeks = []
    for i in range(7, -1, -1):
        week_start = now - timedelta(weeks=i + 1)
        week_end = now - timedelta(weeks=i)
        count = base.filter(Task.completed_at >= week_start, Task.completed_at < week_end).count()
        weeks.append({"week": week_start.strftime("%b %d"), "completed": count})
    return jsonify(weeks)


@task_stats_bp.route("/api/task-stats/workload", methods=["GET"])
@jwt_required()
def get_workload():
    """Open work per person, by assignment (unassigned work is listed separately)."""
    me = current_user()
    if not me or not me.workspace_id:
        return jsonify([])

    now = utcnow_naive()
    base = visible_task_query(me)
    result = []

    for member in User.query.filter_by(workspace_id=me.workspace_id).order_by(User.id):
        mine = base.join(TaskAssignment, TaskAssignment.task_id == Task.id).filter(
            TaskAssignment.user_id == member.id
        )
        total = mine.count()
        completed = mine.filter(Task.status == "completed").count()
        result.append({
            "username":   member.username,
            "total":      total,
            "completed":  completed,
            "inProgress": mine.filter(Task.status == "in-progress").count(),
            "overdue":    mine.filter(Task.due_date < now, Task.status != "completed").count(),
            "open":       total - completed,
        })

    assigned_ids = db.session.query(TaskAssignment.task_id)
    unassigned = base.filter(Task.id.notin_(assigned_ids))
    total = unassigned.count()
    if total:
        completed = unassigned.filter(Task.status == "completed").count()
        result.append({
            "username":   "Unassigned",
            "total":      total,
            "completed":  completed,
            "inProgress": unassigned.filter(Task.status == "in-progress").count(),
            "overdue":    unassigned.filter(Task.due_date < now, Task.status != "completed").count(),
            "open":       total - completed,
        })

    result.sort(key=lambda x: x["total"], reverse=True)
    return jsonify(result)
