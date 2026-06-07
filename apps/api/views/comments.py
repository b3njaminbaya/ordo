from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Comment, Task, User

comments_bp = Blueprint("comments_bp", __name__)

def _serialize_comment(c):
    return {
        "id": c.id,
        "content": c.content,
        "user_id": c.user_id,
        "username": c.user.username if c.user else None,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }

@comments_bp.route("/tasks/<int:task_id>/comments", methods=["POST"])
@jwt_required()
def add_comment(task_id):
    data = request.get_json()
    user_id = int(get_jwt_identity())
    content = data.get("content", "").strip()

    task = db.session.get(Task, task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404

    if not content:
        return jsonify({"error": "Comment cannot be empty"}), 400

    new_comment = Comment(task_id=task_id, user_id=user_id, content=content)
    db.session.add(new_comment)
    db.session.commit()
    db.session.refresh(new_comment)

    comment_dict = _serialize_comment(new_comment)
    user = db.session.get(User, user_id)
    if user and user.workspace_id:
        from views.realtime import emit_comment_added
        emit_comment_added(user.workspace_id, {**comment_dict, "task_id": task_id})

    return jsonify(comment_dict), 201

@comments_bp.route("/tasks/<int:task_id>/comments", methods=["GET"])
@jwt_required()
def get_comments(task_id):
    task = db.session.get(Task, task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404

    comments = Comment.query.filter_by(task_id=task_id).order_by(Comment.id.asc()).all()
    return jsonify([_serialize_comment(c) for c in comments]), 200

# Update a comment (Partial Update)
@comments_bp.route("/comments/<int:comment_id>", methods=["PATCH"])
@jwt_required()
def update_comment(comment_id):
    data = request.get_json()
    user_id = int(get_jwt_identity())

    comment = db.session.get(Comment, comment_id)
    if not comment:
        return jsonify({"error": "Comment not found"}), 404

    if comment.user_id != user_id:
        return jsonify({"error": "Unauthorized to edit this comment"}), 403

    if "content" in data and data["content"].strip():
        comment.content = data["content"]
        db.session.commit()
        serialized = _serialize_comment(comment)
        user = db.session.get(User, user_id)
        if user and user.workspace_id:
            from views.realtime import emit_comment_updated
            emit_comment_updated(user.workspace_id, {**serialized, "task_id": comment.task_id})
        return jsonify(serialized), 200

    return jsonify({"error": "No valid content provided"}), 400

@comments_bp.route("/comments/<int:comment_id>", methods=["DELETE"])
@jwt_required()
def delete_comment(comment_id):
    user_id = int(get_jwt_identity())

    comment = db.session.get(Comment, comment_id)
    if not comment:
        return jsonify({"error": "Comment not found"}), 404

    if comment.user_id != user_id:
        return jsonify({"error": "Unauthorized to delete this comment"}), 403

    task_id = comment.task_id
    db.session.delete(comment)
    db.session.commit()

    user = db.session.get(User, user_id)
    if user and user.workspace_id:
        from views.realtime import emit_comment_deleted
        emit_comment_deleted(user.workspace_id, task_id, comment_id)

    return jsonify({"message": "Comment deleted successfully"}), 200
