from datetime import datetime, timezone

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import Task, db

subtasks_bp = Blueprint("subtasks_bp", __name__)


@subtasks_bp.route("/tasks/<int:task_id>/subtasks", methods=["GET"])
@jwt_required()
def get_subtasks(task_id):
    task = db.session.get(Task, task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404
    subtasks = Task.query.filter_by(parent_task_id=task_id).order_by(Task.created_at.asc()).all()
    return jsonify([s.to_dict() for s in subtasks]), 200


@subtasks_bp.route("/tasks/<int:task_id>/subtasks", methods=["POST"])
@jwt_required()
def add_subtask(task_id):
    task = db.session.get(Task, task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404

    data = request.get_json() or {}
    title = data.get("title", "").strip()
    if not title:
        return jsonify({"error": "title is required"}), 400

    subtask = Task(
        title=title,
        description=data.get("description"),
        priority=data.get("priority", "medium"),
        status=data.get("status", "todo"),
        tasklist_id=task.tasklist_id,
        parent_task_id=task_id,
        created_at=datetime.now(timezone.utc),
    )
    db.session.add(subtask)
    db.session.commit()
    return jsonify(subtask.to_dict()), 201


@subtasks_bp.route("/subtasks/<int:subtask_id>", methods=["PATCH"])
@jwt_required()
def update_subtask(subtask_id):
    subtask = db.session.get(Task, subtask_id)
    if not subtask or subtask.parent_task_id is None:
        return jsonify({"error": "Subtask not found"}), 404

    data = request.get_json() or {}
    for field in ("title", "description", "status", "priority"):
        if field in data:
            setattr(subtask, field, data[field])
    db.session.commit()
    return jsonify(subtask.to_dict()), 200


@subtasks_bp.route("/subtasks/<int:subtask_id>", methods=["DELETE"])
@jwt_required()
def delete_subtask(subtask_id):
    subtask = db.session.get(Task, subtask_id)
    if not subtask or subtask.parent_task_id is None:
        return jsonify({"error": "Subtask not found"}), 404

    db.session.delete(subtask)
    db.session.commit()
    return jsonify({"message": "Subtask deleted"}), 200
