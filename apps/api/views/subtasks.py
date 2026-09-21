from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required

from access import can_access_task, current_user, workspace_id_for_task
from models import db, Task
from serializers import serialize_task
from validation import VALID_PRIORITIES, VALID_STATUSES, json_body, utcnow_naive

subtasks_bp = Blueprint("subtasks_bp", __name__)


def _announce_parent(parent):
    """Push the parent's fresh counts so every open board updates its badge."""
    ws = workspace_id_for_task(parent)
    if ws:
        from views.realtime import emit_task_updated
        emit_task_updated(ws, serialize_task(parent))


def _get_parent(user, task_id):
    task = db.session.get(Task, task_id)
    if not user or not task or task.parent_task_id is not None or not can_access_task(user, task):
        return None
    return task


def _get_subtask(user, subtask_id):
    sub = db.session.get(Task, subtask_id)
    if not user or not sub or sub.parent_task_id is None or not can_access_task(user, sub):
        return None
    return sub


@subtasks_bp.route("/tasks/<int:task_id>/subtasks", methods=["GET"])
@jwt_required()
def get_subtasks(task_id):
    parent = _get_parent(current_user(), task_id)
    if not parent:
        return jsonify({"error": "Task not found"}), 404
    subtasks = Task.query.filter_by(parent_task_id=task_id).order_by(Task.created_at.asc(), Task.id.asc()).all()
    return jsonify([serialize_task(s) for s in subtasks]), 200


@subtasks_bp.route("/tasks/<int:task_id>/subtasks", methods=["POST"])
@jwt_required()
def add_subtask(task_id):
    parent = _get_parent(current_user(), task_id)
    if not parent:
        return jsonify({"error": "Task not found"}), 404

    data = json_body()
    title = data.get("title")
    title = title.strip() if isinstance(title, str) else ""
    if not title:
        return jsonify({"error": "title is required"}), 400
    if len(title) > 100:
        return jsonify({"error": "Title must be 100 characters or fewer"}), 400

    priority = data.get("priority", "medium")
    status = data.get("status", "todo")
    if priority not in VALID_PRIORITIES or status not in VALID_STATUSES:
        return jsonify({"error": "Invalid priority or status"}), 400

    subtask = Task(
        title=title,
        description=data.get("description") if isinstance(data.get("description"), str) else None,
        priority=priority,
        status=status,
        completed_at=utcnow_naive() if status == "completed" else None,
        tasklist_id=parent.tasklist_id,
        parent_task_id=task_id,
    )
    db.session.add(subtask)
    db.session.commit()
    _announce_parent(parent)
    return jsonify(serialize_task(subtask)), 201


@subtasks_bp.route("/subtasks/<int:subtask_id>", methods=["PATCH"])
@jwt_required()
def update_subtask(subtask_id):
    subtask = _get_subtask(current_user(), subtask_id)
    if not subtask:
        return jsonify({"error": "Subtask not found"}), 404

    data = json_body()
    if "title" in data:
        title = data["title"].strip() if isinstance(data["title"], str) else ""
        if not title or len(title) > 100:
            return jsonify({"error": "Title must be 1–100 characters"}), 400
        subtask.title = title
    if "description" in data:
        if data["description"] is not None and not isinstance(data["description"], str):
            return jsonify({"error": "Invalid description"}), 400
        subtask.description = data["description"]
    if "priority" in data:
        if data["priority"] not in VALID_PRIORITIES:
            return jsonify({"error": "Invalid priority"}), 400
        subtask.priority = data["priority"]
    if "status" in data:
        if data["status"] not in VALID_STATUSES:
            return jsonify({"error": "Invalid status"}), 400
        if data["status"] != subtask.status:
            subtask.status = data["status"]
            subtask.completed_at = utcnow_naive() if data["status"] == "completed" else None

    db.session.commit()
    _announce_parent(subtask.parent)
    return jsonify(serialize_task(subtask)), 200


@subtasks_bp.route("/subtasks/<int:subtask_id>", methods=["DELETE"])
@jwt_required()
def delete_subtask(subtask_id):
    subtask = _get_subtask(current_user(), subtask_id)
    if not subtask:
        return jsonify({"error": "Subtask not found"}), 404

    parent = subtask.parent
    db.session.delete(subtask)
    db.session.commit()
    _announce_parent(parent)
    return jsonify({"message": "Subtask deleted"}), 200
