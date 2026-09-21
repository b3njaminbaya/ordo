from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from access import (
    can_access_task, can_access_tasklist, current_user, is_workspace_owner,
    visible_task_query, workspace_id_for_task, workspace_member_ids,
)
from files import attachment_dir, attachment_filenames_for_tasks, remove_files
from models import db, Task, TaskAssignment, TaskList, TaskReminder
from notifications_service import send_notification
from serializers import serialize_task, serialize_tasks
from validation import (
    VALID_PRIORITIES, VALID_STATUSES, int_list, json_body, parse_datetime, to_int, utcnow_naive,
)

task_bp = Blueprint("task_bp", __name__)


# ── Ordering helpers ──────────────────────────────────────────────────────────

def next_position(owner_id, status):
    """Next slot at the bottom of a status column, across the whole workspace."""
    result = (
        db.session.query(db.func.max(Task.position))
        .join(TaskList, Task.tasklist_id == TaskList.id)
        .filter(
            TaskList.user_id.in_(workspace_member_ids(owner_id)),
            Task.status == status,
            Task.parent_task_id.is_(None),
        )
        .scalar()
    )
    return (result + 1) if result is not None else 0


def next_list_position(tasklist_id):
    result = (
        db.session.query(db.func.max(Task.list_position))
        .filter(Task.tasklist_id == tasklist_id, Task.parent_task_id.is_(None))
        .scalar()
    )
    return (result + 1) if result is not None else 0


def _place(task, siblings, attr, index):
    """Insert `task` at `index` among `siblings` (already ordered) and renumber `attr`."""
    ordered = [t for t in siblings if t.id != task.id]
    ordered.insert(max(0, min(index, len(ordered))), task)
    for pos, t in enumerate(ordered):
        setattr(t, attr, pos)


def place_in_column(task, index):
    owner_id = task.tasklist.user_id
    siblings = (
        Task.query.join(TaskList, Task.tasklist_id == TaskList.id)
        .filter(
            TaskList.user_id.in_(workspace_member_ids(owner_id)),
            Task.status == task.status,
            Task.parent_task_id.is_(None),
        )
        .order_by(Task.position, Task.id)
        .all()
    )
    _place(task, siblings, "position", index)


def place_in_list(task, index):
    siblings = (
        Task.query.filter(Task.tasklist_id == task.tasklist_id, Task.parent_task_id.is_(None))
        .order_by(Task.list_position, Task.id)
        .all()
    )
    _place(task, siblings, "list_position", index)


def set_status(task, status, index=None):
    """Change status, keeping completed_at and column order consistent."""
    if status == task.status:
        return
    task.status = status
    task.completed_at = utcnow_naive() if status == "completed" else None
    if index is None:
        task.position = next_position(task.tasklist.user_id, status)
    else:
        db.session.flush()
        place_in_column(task, index)


def emit_task(event, task):
    ws = workspace_id_for_task(task)
    if not ws:
        return
    from views import realtime
    getattr(realtime, event)(ws, serialize_task(task))


# ── Create ────────────────────────────────────────────────────────────────────

@task_bp.route("/tasks", methods=["POST"])
@jwt_required()
def add_task():
    user = current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = json_body()
    tasklist = db.session.get(TaskList, to_int(data.get("tasklist_id")) or 0)
    if not can_access_tasklist(user, tasklist):
        return jsonify({"error": "TaskList not found"}), 404

    title = data.get("title")
    title = title.strip() if isinstance(title, str) else ""
    if not title:
        return jsonify({"error": "Title is required"}), 400
    if len(title) > 100:
        return jsonify({"error": "Title must be 100 characters or fewer"}), 400

    description = data.get("description")
    if description is not None and not isinstance(description, str):
        return jsonify({"error": "Invalid description"}), 400

    priority = data.get("priority", "medium")
    status = data.get("status", "todo")
    if priority not in VALID_PRIORITIES:
        return jsonify({"error": f"priority must be one of: {', '.join(sorted(VALID_PRIORITIES))}"}), 400
    if status not in VALID_STATUSES:
        return jsonify({"error": f"status must be one of: {', '.join(sorted(VALID_STATUSES))}"}), 400

    due_date, err = parse_datetime(data.get("due_date"))
    if err:
        return jsonify({"error": err}), 400

    assignee_ids = []
    if data.get("assignee_ids") not in (None, []):
        assignee_ids = int_list(data.get("assignee_ids"))
        if assignee_ids is None:
            return jsonify({"error": "assignee_ids must be a list of user ids"}), 400
        members = set(workspace_member_ids(tasklist.user_id))
        if not set(assignee_ids) <= members:
            return jsonify({"error": "Assignees must be members of this workspace"}), 400

    task = Task(
        title=title,
        description=description,
        due_date=due_date,
        priority=priority,
        status=status,
        completed_at=utcnow_naive() if status == "completed" else None,
        position=next_position(tasklist.user_id, status),
        list_position=next_list_position(tasklist.id),
        tasklist_id=tasklist.id,
    )
    db.session.add(task)
    db.session.flush()
    for uid in dict.fromkeys(assignee_ids):
        db.session.add(TaskAssignment(task_id=task.id, user_id=uid))
    db.session.commit()

    for uid in dict.fromkeys(assignee_ids):
        if uid != user.id:
            send_notification(uid, f"{user.username} assigned you to task: {task.title}", task_id=task.id)

    emit_task("emit_task_created", task)
    return jsonify(serialize_task(task)), 201


# ── Read ──────────────────────────────────────────────────────────────────────

@task_bp.route("/tasks", methods=["GET"])
@jwt_required()
def get_tasks():
    user = current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    query = visible_task_query(user)

    if p := request.args.get("priority"):
        query = query.filter(Task.priority == p) if p in VALID_PRIORITIES else query.filter(db.false())
    if s := request.args.get("status"):
        query = query.filter(Task.status == s) if s in VALID_STATUSES else query.filter(db.false())
    if d := request.args.get("due_date"):
        due, err = parse_datetime(d)
        if err or due is None:
            return jsonify({"error": "Invalid date format. Use YYYY-MM-DD."}), 400
        query = query.filter(db.func.date(Task.due_date) == due.date())
    if q := request.args.get("q", "").strip():
        like = "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
        query = query.filter(
            db.or_(Task.title.ilike(like, escape="\\"), Task.description.ilike(like, escape="\\"))
        )
    if (assignee_id := request.args.get("assignee_id")) is not None and assignee_id != "":
        uid = to_int(assignee_id)
        if uid is None:
            return jsonify({"error": "Invalid assignee_id"}), 400
        query = query.join(TaskAssignment, Task.id == TaskAssignment.task_id).filter(TaskAssignment.user_id == uid)

    tasks = query.order_by(Task.position.asc(), Task.id.asc()).all()
    return jsonify(serialize_tasks(tasks)), 200


@task_bp.route("/tasks/calendar", methods=["GET"])
@jwt_required()
def get_calendar_tasks():
    """Tasks with due dates between start and end (YYYY-MM-DD, inclusive)."""
    user = current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    start_str = request.args.get("start")
    end_str = request.args.get("end")
    if not start_str or not end_str:
        return jsonify({"error": "start and end query params required"}), 400

    start, err1 = parse_datetime(start_str)
    end, err2 = parse_datetime(end_str)
    if err1 or err2 or start is None or end is None:
        return jsonify({"error": "Invalid date format. Use YYYY-MM-DD."}), 400
    end = end.replace(hour=23, minute=59, second=59)

    tasks = (
        visible_task_query(user)
        .filter(Task.due_date >= start, Task.due_date <= end)
        .order_by(Task.due_date)
        .all()
    )
    return jsonify(serialize_tasks(tasks)), 200


@task_bp.route("/tasks/<int:task_id>", methods=["GET"])
@jwt_required()
def get_task(task_id):
    user = current_user()
    task = db.session.get(Task, task_id)
    if not user or not can_access_task(user, task):
        return jsonify({"error": "Task not found"}), 404
    return jsonify(serialize_task(task)), 200


# ── Reorder ───────────────────────────────────────────────────────────────────

@task_bp.route("/tasks/reorder", methods=["PATCH"])
@jwt_required()
def reorder_tasks():
    """Reorder one status column: `order` lists task ids top to bottom."""
    user = current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = json_body()
    status = data.get("status")
    order = int_list(data.get("order"))

    if status not in VALID_STATUSES or order is None:
        return jsonify({"error": "status and order[] are required"}), 400
    if not order:
        return jsonify({"message": "No tasks to reorder"}), 200
    if len(set(order)) != len(order):
        return jsonify({"error": "order contains duplicate ids"}), 400

    tasks_by_id = {t.id: t for t in visible_task_query(user).filter(Task.status == status).all()}
    for task_id in order:
        if task_id not in tasks_by_id:
            return jsonify({"error": f"Task {task_id} not found or not accessible"}), 403

    for position, task_id in enumerate(order):
        tasks_by_id[task_id].position = position
    db.session.commit()
    return jsonify({"message": "Reordered", "count": len(order)}), 200


# ── Update ────────────────────────────────────────────────────────────────────

@task_bp.route("/tasks/<int:task_id>", methods=["PATCH"])
@jwt_required()
def update_task(task_id):
    user = current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    task = db.session.get(Task, task_id)
    if not can_access_task(user, task):
        return jsonify({"error": "Task not found"}), 404

    data = json_body()

    if "title" in data:
        title = data["title"].strip() if isinstance(data["title"], str) else ""
        if not title:
            return jsonify({"error": "Title cannot be empty"}), 400
        if len(title) > 100:
            return jsonify({"error": "Title must be 100 characters or fewer"}), 400
        task.title = title

    if "description" in data:
        if data["description"] is not None and not isinstance(data["description"], str):
            return jsonify({"error": "Invalid description"}), 400
        task.description = data["description"]

    if "priority" in data:
        if data["priority"] not in VALID_PRIORITIES:
            return jsonify({"error": f"priority must be one of: {', '.join(sorted(VALID_PRIORITIES))}"}), 400
        task.priority = data["priority"]

    if "due_date" in data:
        due_date, err = parse_datetime(data["due_date"])
        if err:
            return jsonify({"error": err}), 400
        if due_date != task.due_date:
            task.due_date = due_date
            # A rescheduled task deserves fresh reminders.
            TaskReminder.query.filter_by(task_id=task.id).delete(synchronize_session=False)

    if "tasklist_id" in data and to_int(data["tasklist_id"]) != task.tasklist_id:
        target = db.session.get(TaskList, to_int(data["tasklist_id"]) or 0)
        if not can_access_tasklist(user, target):
            return jsonify({"error": "TaskList not found"}), 404
        task.tasklist_id = target.id
        db.session.flush()
        db.session.expire(task, ["tasklist"])
        list_index = to_int(data.get("list_index"))
        if list_index is None:
            task.list_position = next_list_position(target.id)
        else:
            place_in_list(task, list_index)

    if "status" in data:
        if data["status"] not in VALID_STATUSES:
            return jsonify({"error": f"status must be one of: {', '.join(sorted(VALID_STATUSES))}"}), 400
        set_status(task, data["status"], to_int(data.get("index")))

    db.session.commit()
    emit_task("emit_task_updated", task)
    return jsonify(serialize_task(task)), 200


# ── Delete ────────────────────────────────────────────────────────────────────

@task_bp.route("/tasks/<int:task_id>", methods=["DELETE"])
@jwt_required()
def delete_task(task_id):
    user = current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    task = db.session.get(Task, task_id)
    if not can_access_task(user, task):
        return jsonify({"error": "Task not found"}), 404
    if task.tasklist.user_id != user.id and not is_workspace_owner(user):
        return jsonify({"error": "Only the list owner or workspace owner can delete tasks"}), 403

    ws = workspace_id_for_task(task)
    parent_id = task.parent_task_id
    ids = [task.id] + [s.id for s in task.subtasks]
    files = attachment_filenames_for_tasks(ids)

    db.session.delete(task)
    db.session.commit()
    remove_files(attachment_dir(), files)

    from views import realtime
    if ws:
        realtime.emit_task_deleted(ws, task_id)
        if parent_id:
            parent = db.session.get(Task, parent_id)
            if parent:
                realtime.emit_task_updated(ws, serialize_task(parent))

    return jsonify({"message": "Task deleted"}), 200
