"""Socket.IO events.

Connections must present a valid access token (`auth: {token}`). Rooms are chosen
by the server from the authenticated user — a client can never name a workspace
or user room itself.
"""
import structlog
from flask_jwt_extended import decode_token
from flask_socketio import join_room

from app import socketio
from models import db, User

logger = structlog.get_logger()


def _authenticate(auth):
    token = auth.get("token") if isinstance(auth, dict) else None
    if not token or not isinstance(token, str):
        return None
    try:
        decoded = decode_token(token)
    except Exception:  # noqa: BLE001 — expired, malformed, wrong signature …
        return None
    if decoded.get("type") != "access":
        return None

    from app import check_if_token_revoked
    if check_if_token_revoked({}, decoded):
        return None
    return db.session.get(User, int(decoded["sub"]))


@socketio.on("connect")
def handle_connect(auth=None):
    user = _authenticate(auth)
    if user is None:
        logger.info("socket_rejected")
        return False  # refuses the connection

    join_room(f"user_{user.id}")
    if user.workspace_id:
        join_room(f"workspace_{user.workspace_id}")


@socketio.on("disconnect")
def handle_disconnect(*_):
    pass


def emit_task_updated(workspace_id, task_dict):
    """Broadcast a task change to every client in the workspace room."""
    socketio.emit("task_updated", task_dict, room=f"workspace_{workspace_id}")


def emit_task_created(workspace_id, task_dict):
    socketio.emit("task_created", task_dict, room=f"workspace_{workspace_id}")


def emit_task_deleted(workspace_id, task_id):
    socketio.emit("task_deleted", {"id": task_id}, room=f"workspace_{workspace_id}")


def emit_tasklist_changed(workspace_id):
    """Lists were created, renamed, deleted or reordered — clients should refetch."""
    socketio.emit("tasklist_changed", {}, room=f"workspace_{workspace_id}")


def emit_comment_added(workspace_id, comment_dict):
    socketio.emit("comment_added", comment_dict, room=f"workspace_{workspace_id}")


def emit_comment_updated(workspace_id, comment_dict):
    socketio.emit("comment_updated", comment_dict, room=f"workspace_{workspace_id}")


def emit_comment_deleted(workspace_id, task_id, comment_id):
    socketio.emit("comment_deleted", {"task_id": task_id, "comment_id": comment_id}, room=f"workspace_{workspace_id}")


def emit_notification(user_id, notification_dict):
    socketio.emit("notification", notification_dict, room=f"user_{user_id}")


def emit_timer_started(user_id, entry_dict):
    """Broadcast to the user's personal room so all their open tabs stay in sync."""
    socketio.emit("timer_started", entry_dict, room=f"user_{user_id}")


def emit_timer_stopped(user_id, entry_dict):
    socketio.emit("timer_stopped", entry_dict, room=f"user_{user_id}")
