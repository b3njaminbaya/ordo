from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Task, User, TaskList, TaskAssignment
from datetime import datetime, timezone

task_bp = Blueprint("task_bp", __name__)


def _get_user():
    return db.session.get(User, get_jwt_identity())


def _user_task_base(user_id):
    """Base query: only tasks belonging to the authenticated user's task lists."""
    return Task.query.join(TaskList, Task.tasklist_id == TaskList.id).filter(TaskList.user_id == user_id)


@task_bp.route("/tasks", methods=["POST"])
@jwt_required()
def add_task():
    user = _get_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json()
    tasklist = db.session.get(TaskList, data.get("tasklist_id"))
    if not tasklist:
        return jsonify({"error": "TaskList not found"}), 404

    due_date = None
    if data.get("due_date"):
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
            try:
                due_date = datetime.strptime(data["due_date"], fmt)
                break
            except ValueError:
                continue
        else:
            return jsonify({"error": "Invalid date format. Use YYYY-MM-DD."}), 400

    task = Task(
        title=data.get("title"),
        description=data.get("description"),
        due_date=due_date,
        priority=data.get("priority", "medium"),
        status=data.get("status", "todo"),
        tasklist_id=data["tasklist_id"],
        created_at=datetime.now(timezone.utc),
    )
    db.session.add(task)
    db.session.commit()

    # Real-time: broadcast new task to workspace members
    if user.workspace_id:
        from views.realtime import emit_task_created
        emit_task_created(user.workspace_id, task.to_dict())

    return jsonify(task.to_dict()), 201


@task_bp.route("/tasks", methods=["GET"])
@jwt_required()
def get_tasks():
    user = _get_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    query = _user_task_base(user.id)

    if p := request.args.get("priority"):
        query = query.filter(Task.priority == p)
    if s := request.args.get("status"):
        query = query.filter(Task.status == s)
    if d := request.args.get("due_date"):
        try:
            due = datetime.strptime(d, "%Y-%m-%d").date()
            query = query.filter(db.func.date(Task.due_date) == due)
        except ValueError:
            return jsonify({"error": "Invalid date format. Use YYYY-MM-DD."}), 400

    return jsonify([t.to_dict() for t in query.all()]), 200


@task_bp.route("/tasks/calendar", methods=["GET"])
@jwt_required()
def get_calendar_tasks():
    """Return user tasks with due dates between start and end (YYYY-MM-DD)."""
    user = _get_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    start_str = request.args.get("start")
    end_str = request.args.get("end")
    if not start_str or not end_str:
        return jsonify({"error": "start and end query params required"}), 400

    try:
        start = datetime.strptime(start_str, "%Y-%m-%d")
        end = datetime.strptime(end_str, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
    except ValueError:
        return jsonify({"error": "Invalid date format. Use YYYY-MM-DD."}), 400

    tasks = (
        _user_task_base(user.id)
        .filter(Task.due_date >= start, Task.due_date <= end)
        .order_by(Task.due_date)
        .all()
    )
    return jsonify([t.to_dict() for t in tasks]), 200


@task_bp.route("/tasks/<int:task_id>", methods=["PATCH"])
@jwt_required()
def update_task(task_id):
    user = _get_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    task = Task.query.filter_by(id=task_id).first_or_404(description="Task not found")
    assignment = TaskAssignment.query.filter_by(task_id=task.id, user_id=user.id).first()
    if user.id != task.tasklist.user_id and user.role != "admin" and not assignment:
        return jsonify({"error": "Unauthorized"}), 403

    data = request.get_json()
    for field in ("status", "title", "description", "priority"):
        if field in data:
            setattr(task, field, data[field])
    if "due_date" in data:
        task.due_date = data["due_date"]
    if "tasklist_id" in data:
        tl = db.session.get(TaskList, data["tasklist_id"])
        if not tl:
            return jsonify({"error": "TaskList not found"}), 404
        task.tasklist_id = data["tasklist_id"]

    db.session.commit()

    # Real-time: broadcast update to workspace
    if user.workspace_id:
        from views.realtime import emit_task_updated
        emit_task_updated(user.workspace_id, task.to_dict())

    return jsonify(task.to_dict()), 200


@task_bp.route("/tasks/<int:task_id>", methods=["DELETE"])
@jwt_required()
def delete_task(task_id):
    user = _get_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    task = Task.query.filter_by(id=task_id).first_or_404(description="Task not found")
    if user.id != task.tasklist.user_id and user.role != "admin":
        return jsonify({"error": "Unauthorized"}), 403

    task_dict = {"id": task.id}
    db.session.delete(task)
    db.session.commit()

    if user.workspace_id:
        from views.realtime import emit_task_deleted
        emit_task_deleted(user.workspace_id, task.id)

    return jsonify({"message": "Task deleted"}), 200


@task_bp.route("/tasks/featured", methods=["GET"])
def get_featured_tasks():
    featured = []
    for priority in ("low", "medium", "high"):
        task = Task.query.filter_by(priority=priority).order_by(Task.created_at.desc()).first()
        if task:
            featured.append(task.to_dict())
    return jsonify(featured), 200
