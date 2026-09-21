from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required

from access import can_access_task, current_user, workspace_id_for_task
from models import db, Comment, Task
from notifications_service import send_notification
from serializers import iso_utc
from validation import json_body

comments_bp = Blueprint("comments_bp", __name__)

MAX_COMMENT_LENGTH = 5000


def _serialize_comment(c):
    return {
        "id": c.id,
        "content": c.content,
        "user_id": c.user_id,
        "username": c.user.username if c.user else None,
        "created_at": iso_utc(c.created_at),
    }


def _task_for(user, task_id):
    task = db.session.get(Task, task_id)
    return task if user and can_access_task(user, task) else None


def _clean(content):
    content = content.strip() if isinstance(content, str) else ""
    if not content:
        return None, "Comment cannot be empty"
    if len(content) > MAX_COMMENT_LENGTH:
        return None, f"Comment must be {MAX_COMMENT_LENGTH} characters or fewer"
    return content, None


@comments_bp.route("/tasks/<int:task_id>/comments", methods=["POST"])
@jwt_required()
def add_comment(task_id):
    user = current_user()
    task = _task_for(user, task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404

    content, err = _clean(json_body().get("content"))
    if err:
        return jsonify({"error": err}), 400

    comment = Comment(task_id=task_id, user_id=user.id, content=content)
    db.session.add(comment)
    db.session.commit()
    db.session.refresh(comment)

    payload = _serialize_comment(comment)
    ws = workspace_id_for_task(task)
    if ws:
        from views.realtime import emit_comment_added
        emit_comment_added(ws, {**payload, "task_id": task_id})

    # Let the list owner and assignees know (never the author).
    recipients = {task.tasklist.user_id} | {a.user_id for a in task.assignments}
    for uid in recipients - {user.id}:
        send_notification(uid, f"{user.username} commented on: {task.title}", task_id=task.id)

    return jsonify(payload), 201


@comments_bp.route("/tasks/<int:task_id>/comments", methods=["GET"])
@jwt_required()
def get_comments(task_id):
    user = current_user()
    if not _task_for(user, task_id):
        return jsonify({"error": "Task not found"}), 404

    comments = Comment.query.filter_by(task_id=task_id).order_by(Comment.id.asc()).all()
    return jsonify([_serialize_comment(c) for c in comments]), 200


@comments_bp.route("/comments/<int:comment_id>", methods=["PATCH"])
@jwt_required()
def update_comment(comment_id):
    user = current_user()
    comment = db.session.get(Comment, comment_id)
    if not user or not comment:
        return jsonify({"error": "Comment not found"}), 404
    if comment.user_id != user.id:
        return jsonify({"error": "Unauthorized to edit this comment"}), 403

    content, err = _clean(json_body().get("content"))
    if err:
        return jsonify({"error": err}), 400

    comment.content = content
    db.session.commit()
    payload = _serialize_comment(comment)

    ws = workspace_id_for_task(comment.task)
    if ws:
        from views.realtime import emit_comment_updated
        emit_comment_updated(ws, {**payload, "task_id": comment.task_id})
    return jsonify(payload), 200


@comments_bp.route("/comments/<int:comment_id>", methods=["DELETE"])
@jwt_required()
def delete_comment(comment_id):
    user = current_user()
    comment = db.session.get(Comment, comment_id)
    if not user or not comment:
        return jsonify({"error": "Comment not found"}), 404
    if comment.user_id != user.id:
        return jsonify({"error": "Unauthorized to delete this comment"}), 403

    task_id = comment.task_id
    ws = workspace_id_for_task(comment.task)
    db.session.delete(comment)
    db.session.commit()

    if ws:
        from views.realtime import emit_comment_deleted
        emit_comment_deleted(ws, task_id, comment_id)
    return jsonify({"message": "Comment deleted successfully"}), 200
