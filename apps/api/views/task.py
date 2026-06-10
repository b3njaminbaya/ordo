from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Task, User, TaskList, TaskAssignment
from datetime import datetime, timezone

task_bp = Blueprint("task_bp", __name__)


def _get_user():
    return db.session.get(User, int(get_jwt_identity()))


def _user_task_base(user):
    """Base query: tasks in the user's workspace, or own tasks if no workspace."""
    base = Task.query.join(TaskList, Task.tasklist_id == TaskList.id)
    if user.workspace_id:
        member_ids = db.session.query(User.id).filter_by(workspace_id=user.workspace_id)
        return base.filter(TaskList.user_id.in_(member_ids))
    return base.filter(TaskList.user_id == user.id)


def _task_dict(task):
    """Serialize a task with its assignee list included."""
    d = task.to_dict()
    d["assignees"] = [
        {"id": a.user_id, "username": a.user.username if a.user else None}
        for a in task.assignments
    ]
    return d


def _next_position(user_id, status):
    """Return max position + 1 for the given status column owned by user."""
    result = (
        db.session.query(db.func.max(Task.position))
        .join(TaskList, Task.tasklist_id == TaskList.id)
        .filter(TaskList.user_id == user_id, Task.status == status)
        .scalar()
    )
    return (result + 1) if result is not None else 0


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

    status = data.get("status", "todo")
    task = Task(
        title=data.get("title"),
        description=data.get("description"),
        due_date=due_date,
        priority=data.get("priority", "medium"),
        status=status,
        position=_next_position(tasklist.user_id, status),
        tasklist_id=data["tasklist_id"],
        created_at=datetime.now(timezone.utc),
    )
    db.session.add(task)
    db.session.commit()

    # Real-time: broadcast new task to workspace members
    if user.workspace_id:
        from views.realtime import emit_task_created
        emit_task_created(user.workspace_id, _task_dict(task))

    return jsonify(_task_dict(task)), 201


@task_bp.route("/tasks", methods=["GET"])
@jwt_required()
def get_tasks():
    user = _get_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    query = _user_task_base(user)

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
    if q := request.args.get("q", "").strip():
        query = query.filter(
            db.or_(Task.title.ilike(f"%{q}%"), Task.description.ilike(f"%{q}%"))
        )
    if assignee_id := request.args.get("assignee_id"):
        try:
            query = query.join(TaskAssignment, Task.id == TaskAssignment.task_id).filter(
                TaskAssignment.user_id == int(assignee_id)
            )
        except (ValueError, TypeError):
            return jsonify({"error": "Invalid assignee_id"}), 400

    tasks = query.order_by(Task.position.asc(), Task.created_at.asc()).all()
    return jsonify([_task_dict(t) for t in tasks]), 200


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
        _user_task_base(user)
        .filter(Task.due_date >= start, Task.due_date <= end)
        .order_by(Task.due_date)
        .all()
    )
    return jsonify([t.to_dict() for t in tasks]), 200


@task_bp.route("/tasks/reorder", methods=["PATCH"])
@jwt_required()
def reorder_tasks():
    """Atomically reorder tasks within a column by assigning sequential positions."""
    user = _get_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json()
    status = data.get("status")
    order = data.get("order")

    if not status or not isinstance(order, list):
        return jsonify({"error": "status and order[] are required"}), 400

    if not order:
        return jsonify({"message": "No tasks to reorder"}), 200

    # Load all user tasks for this status in one query
    tasks_by_id = {
        t.id: t
        for t in _user_task_base(user).filter(Task.status == status).all()
    }

    # Validate every ID in order belongs to the user and has this status
    for task_id in order:
        if task_id not in tasks_by_id:
            return jsonify({"error": f"Task {task_id} not found or not accessible"}), 403

    # Assign positions atomically within the transaction
    for position, task_id in enumerate(order):
        tasks_by_id[task_id].position = position

    db.session.commit()
    return jsonify({"message": "Reordered", "count": len(order)}), 200


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

    # When status changes, move task to the end of the destination column
    if "status" in data and data["status"] != task.status:
        task.status = data["status"]
        task.position = _next_position(task.tasklist.user_id, data["status"])

    for field in ("title", "description", "priority"):
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
        emit_task_updated(user.workspace_id, _task_dict(task))

    return jsonify(_task_dict(task)), 200


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
