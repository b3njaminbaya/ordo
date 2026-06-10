from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Task, TaskAssignment, User, TaskList, Notification

task_assignment_bp = Blueprint("task_assignment_bp", __name__)


def _can_manage_task(tasklist, current_user_id):
    """Allow the tasklist owner or any member of the same workspace."""
    if tasklist.user_id == current_user_id:
        return True
    current_user = db.session.get(User, current_user_id)
    tasklist_owner = db.session.get(User, tasklist.user_id)
    return (
        current_user
        and tasklist_owner
        and current_user.workspace_id
        and current_user.workspace_id == tasklist_owner.workspace_id
    )


@task_assignment_bp.route("/tasks/<int:task_id>/assign", methods=["POST"])
@jwt_required()
def assign_users_to_task(task_id):
    current_user_id = int(get_jwt_identity())
    data = request.get_json()
    user_ids = data.get('user_ids', [])

    task = db.session.get(Task, task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404

    tasklist = db.session.get(TaskList, task.tasklist_id)
    if not tasklist or not _can_manage_task(tasklist, current_user_id):
        return jsonify({'error': 'Unauthorized to assign users to this task'}), 403

    if not user_ids:
        return jsonify({"success": "No users assigned (Task remains unassigned)"}), 200

    assigned_users = []
    for user_id in user_ids:
        user = db.session.get(User, user_id)
        if not user:
            continue

        assignment = TaskAssignment.query.filter_by(task_id=task.id, user_id=user.id).first()
        if assignment:
            continue

        new_assignment = TaskAssignment(task_id=task.id, user_id=user.id)
        db.session.add(new_assignment)
        assigned_users.append({
            "id": user.id,
            "username": user.username,
            "email": user.email
        })

        notification = Notification(user_id=user.id, task_id=task.id, message=f"You have been assigned to task: {task.title}")
        db.session.add(notification)

    db.session.commit()
    return jsonify({"success": "Users assigned successfully", "assigned_users": assigned_users}), 200


@task_assignment_bp.route("/tasks/<int:task_id>/assign/<int:user_id>", methods=["DELETE"])
@jwt_required()
def remove_user_from_task(task_id, user_id):
    current_user_id = int(get_jwt_identity())

    task = db.session.get(Task, task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404

    tasklist = db.session.get(TaskList, task.tasklist_id)
    if not tasklist or not _can_manage_task(tasklist, current_user_id):
        return jsonify({'error': 'Unauthorized to remove users from this task'}), 403

    assignment = TaskAssignment.query.filter_by(task_id=task_id, user_id=user_id).first()
    if not assignment:
        return jsonify({"error": "User is not assigned to this task"}), 404

    db.session.delete(assignment)

    notification = Notification(user_id=user_id, task_id=task.id, message=f"You have been removed from task: {task.title}")
    db.session.add(notification)

    db.session.commit()
    return jsonify({"success": "User removed from task successfully"}), 200
