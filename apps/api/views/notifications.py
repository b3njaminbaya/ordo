from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Notification, User, Task
from datetime import datetime, timedelta, timezone

notifications_bp = Blueprint("notifications_bp", __name__)


def get_user():
    user_id = get_jwt_identity()
    return db.session.get(User, user_id)


def send_notification(user_id, message, task_id=None):
    """Creates a persisted notification and pushes it via Socket.IO."""
    notification = Notification(user_id=user_id, message=message, task_id=task_id)
    db.session.add(notification)
    db.session.commit()

    try:
        from app import socketio
        socketio.emit(
            "notification",
            {"id": notification.id, "message": message, "task_id": task_id, "is_read": False},
            room=f"user_{user_id}",
        )
    except Exception:
        pass


@notifications_bp.route("/notifications", methods=["GET"])
@jwt_required()
def get_notifications():
    """Fetches notifications for the logged-in user."""
    user = get_user()
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 5, type=int)
    notifications = Notification.query.filter_by(user_id=user.id).order_by(Notification.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        "notifications": [
            {"id": n.id, "message": n.message, "is_read": n.is_read, "created_at": n.created_at}
            for n in notifications.items
        ],
        "total_pages": notifications.pages,
        "current_page": notifications.page
    })

# Mark a notification as read
@notifications_bp.route("/notifications/<int:notification_id>/read", methods=["PUT"])
@jwt_required()
def mark_notification_as_read(notification_id):
    """Marks a notification as read."""
    user = get_user()
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    notification = Notification.query.filter_by(id=notification_id, user_id=user.id).first()
    
    if not notification:
        return jsonify({"error": "Notification not found"}), 404

    notification.is_read = True
    db.session.commit()

    return jsonify({"success": "Notification marked as read"}), 200


@notifications_bp.route("/notifications/read-all", methods=["PATCH"])
@jwt_required()
def mark_all_notifications_as_read():
    """Marks all notifications as read for the logged-in user."""
    user = get_user()
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    Notification.query.filter_by(user_id=user.id, is_read=False).update({"is_read": True})
    db.session.commit()
    return jsonify({"message": "All notifications marked as read"}), 200

# Delete a notification
@notifications_bp.route("/notifications/<int:notification_id>", methods=["DELETE"])
@jwt_required()
def delete_notification(notification_id):
    """Deletes a notification."""
    user = get_user()
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    notification = Notification.query.filter_by(id=notification_id, user_id=user.id).first()
    if not notification:
        return jsonify({"error": "Notification not found"}), 404

    db.session.delete(notification)
    db.session.commit()

    return jsonify({"message": "Notification deleted successfully"}), 200


@notifications_bp.route("/notifications/settings", methods=["PATCH"])
@jwt_required()
def toggle_notifications():
    """Allows users to enable or disable notifications."""
    user = get_user()
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    data = request.get_json()
    enable_notifications = data.get("enable_notifications", True)
    user.notifications_enabled = enable_notifications 
    db.session.commit()
    
    return jsonify({"message": "Notification settings updated", "enabled": enable_notifications}), 200


def check_task_deadlines():
    """Sends deadline notifications for tasks due within the next hour (respects user preference)."""
    cutoff = datetime.now(timezone.utc) + timedelta(hours=1)
    upcoming = Task.query.filter(
        Task.due_date <= cutoff,
        Task.due_date >= datetime.now(timezone.utc),
        Task.status != "completed",
    ).all()

    for task in upcoming:
        recipients = {task.tasklist.user_id} | {a.user_id for a in task.assignments}
        for uid in recipients:
            user = db.session.get(User, uid)
            if user and user.notifications_enabled:
                send_notification(uid, f"Task '{task.title}' is due within the hour!", task_id=task.id)
