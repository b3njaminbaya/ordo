from flask_socketio import SocketIO, join_room, leave_room, emit
from flask import request, current_app
from app import socketio


@socketio.on("connect")
def handle_connect():
    pass


@socketio.on("disconnect")
def handle_disconnect():
    pass


@socketio.on("join_workspace")
def handle_join(data):
    """Client sends {workspace_id} to subscribe to workspace events."""
    workspace_id = data.get("workspace_id")
    if workspace_id:
        join_room(f"workspace_{workspace_id}")


@socketio.on("leave_workspace")
def handle_leave(data):
    workspace_id = data.get("workspace_id")
    if workspace_id:
        leave_room(f"workspace_{workspace_id}")


@socketio.on("join_user")
def handle_join_user(data):
    """Client sends {user_id} to subscribe to personal notifications."""
    user_id = data.get("user_id")
    if user_id:
        join_room(f"user_{user_id}")


def emit_task_updated(workspace_id, task_dict):
    """Broadcast a task change to every client in the workspace room."""
    socketio.emit("task_updated", task_dict, room=f"workspace_{workspace_id}")


def emit_task_created(workspace_id, task_dict):
    socketio.emit("task_created", task_dict, room=f"workspace_{workspace_id}")


def emit_task_deleted(workspace_id, task_id):
    socketio.emit("task_deleted", {"id": task_id}, room=f"workspace_{workspace_id}")


def emit_comment_added(workspace_id, comment_dict):
    socketio.emit("comment_added", comment_dict, room=f"workspace_{workspace_id}")


def emit_comment_updated(workspace_id, comment_dict):
    socketio.emit("comment_updated", comment_dict, room=f"workspace_{workspace_id}")


def emit_comment_deleted(workspace_id, task_id, comment_id):
    socketio.emit("comment_deleted", {"task_id": task_id, "comment_id": comment_id}, room=f"workspace_{workspace_id}")
