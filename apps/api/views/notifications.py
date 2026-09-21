from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from access import current_user
from models import db, Notification
from notifications_service import check_task_deadlines, send_notification  # noqa: F401  (re-exported for the scheduler)

notifications_bp = Blueprint("notifications_bp", __name__)


@notifications_bp.route("/notifications", methods=["GET"])
@jwt_required()
def get_notifications():
    user = current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    page = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("per_page", 10, type=int), 100)
    paginated = (
        Notification.query
        .filter_by(user_id=user.id)
        .order_by(Notification.created_at.desc(), Notification.id.desc())
        .paginate(page=page, per_page=per_page, error_out=False)
    )

    return jsonify({
        "notifications": [
            {
                "id": n.id,
                "message": n.message,
                "is_read": bool(n.is_read),
                "task_id": n.task_id,
                "created_at": n.created_at.isoformat() + "Z" if n.created_at else None,
            }
            for n in paginated.items
        ],
        "total_pages": paginated.pages,
        "current_page": paginated.page,
        "unread_count": Notification.query.filter_by(user_id=user.id, is_read=False).count(),
    })


@notifications_bp.route("/notifications/<int:notification_id>/read", methods=["PUT"])
@jwt_required()
def mark_notification_as_read(notification_id):
    user = current_user()
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
    user = current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    Notification.query.filter_by(user_id=user.id, is_read=False).update({"is_read": True})
    db.session.commit()
    return jsonify({"message": "All notifications marked as read"}), 200


@notifications_bp.route("/notifications/<int:notification_id>", methods=["DELETE"])
@jwt_required()
def delete_notification(notification_id):
    user = current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    notification = Notification.query.filter_by(id=notification_id, user_id=user.id).first()
    if not notification:
        return jsonify({"error": "Notification not found"}), 404

    db.session.delete(notification)
    db.session.commit()
    return jsonify({"message": "Notification deleted successfully"}), 200
