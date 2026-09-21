from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required

from access import can_access_task, current_user, workspace_id_for_task, workspace_member_ids
from models import db, Task, TaskAssignment
from notifications_service import send_notification
from serializers import serialize_task
from validation import int_list, json_body

task_assignment_bp = Blueprint("task_assignment_bp", __name__)


def _load(task_id):
    user = current_user()
    task = db.session.get(Task, task_id)
    if not user or not can_access_task(user, task):
        return None, None
    return user, task


def _announce(task):
    ws = workspace_id_for_task(task)
    if ws:
        from views.realtime import emit_task_updated
        emit_task_updated(ws, serialize_task(task))


def _validated_ids(task, raw):
    ids = int_list(raw)
    if ids is None:
        return None, "user_ids must be a list of user ids"
    if not set(ids) <= set(workspace_member_ids(task.tasklist.user_id)):
        return None, "Assignees must be members of this workspace"
    return list(dict.fromkeys(ids)), None


def _notify(actor, task, added, removed):
    for uid in added:
        if uid != actor.id:
            send_notification(uid, f"{actor.username} assigned you to task: {task.title}", task_id=task.id)
    for uid in removed:
        if uid != actor.id:
            send_notification(uid, f"You have been removed from task: {task.title}", task_id=task.id)


@task_assignment_bp.route("/tasks/<int:task_id>/assign", methods=["POST"])
@jwt_required()
def assign_users_to_task(task_id):
    """Add assignees (existing ones are kept)."""
    user, task = _load(task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404

    ids, err = _validated_ids(task, json_body().get("user_ids", []))
    if err:
        return jsonify({"error": err}), 400

    existing = {a.user_id for a in task.assignments}
    added = [uid for uid in ids if uid not in existing]
    for uid in added:
        db.session.add(TaskAssignment(task_id=task.id, user_id=uid))
    db.session.commit()
    db.session.refresh(task)

    _notify(user, task, added, [])
    _announce(task)
    return jsonify({"success": "Users assigned successfully", "task": serialize_task(task)}), 200


@task_assignment_bp.route("/tasks/<int:task_id>/assignees", methods=["PUT"])
@jwt_required()
def set_task_assignees(task_id):
    """Replace the assignee list with exactly `user_ids`."""
    user, task = _load(task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404

    ids, err = _validated_ids(task, json_body().get("user_ids", []))
    if err:
        return jsonify({"error": err}), 400

    existing = {a.user_id: a for a in task.assignments}
    added = [uid for uid in ids if uid not in existing]
    removed = [uid for uid in existing if uid not in ids]
    for uid in removed:
        db.session.delete(existing[uid])
    for uid in added:
        db.session.add(TaskAssignment(task_id=task.id, user_id=uid))
    db.session.commit()
    db.session.refresh(task)

    _notify(user, task, added, removed)
    _announce(task)
    return jsonify({"success": "Assignees updated", "task": serialize_task(task)}), 200


@task_assignment_bp.route("/tasks/<int:task_id>/assign/<int:user_id>", methods=["DELETE"])
@jwt_required()
def remove_user_from_task(task_id, user_id):
    user, task = _load(task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404

    assignment = TaskAssignment.query.filter_by(task_id=task_id, user_id=user_id).first()
    if not assignment:
        return jsonify({"error": "User is not assigned to this task"}), 404

    db.session.delete(assignment)
    db.session.commit()
    db.session.refresh(task)

    _notify(user, task, [], [user_id])
    _announce(task)
    return jsonify({"success": "User removed from task successfully", "task": serialize_task(task)}), 200
