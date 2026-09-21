import mimetypes
import os
from uuid import uuid4

import structlog
from flask import Blueprint, jsonify, request, send_from_directory
from flask_jwt_extended import jwt_required
from werkzeug.utils import secure_filename

from access import can_access_task, current_user, is_workspace_owner, workspace_id_for_task
from files import attachment_dir, remove_files
from models import db, Task, TaskAttachment
from serializers import iso_utc, serialize_task

logger = structlog.get_logger()

attachments_bp = Blueprint("attachments_bp", __name__)

# SVG is deliberately absent: it can carry scripts.
ALLOWED_EXTENSIONS = {
    "png", "jpg", "jpeg", "gif", "webp",
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
    "txt", "md", "csv",
    "zip",
}
MAX_FILE_SIZE = 10 * 1024 * 1024   # 10 MB
MAX_PER_TASK = 10


def _ext(filename):
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


def _load_task(task_id):
    user = current_user()
    task = db.session.get(Task, task_id)
    if not user or not can_access_task(user, task):
        return None, None
    return user, task


def _can_delete(attachment, task, user):
    """Uploader, list owner or workspace owner."""
    return (
        attachment.uploaded_by == user.id
        or task.tasklist.user_id == user.id
        or is_workspace_owner(user)
    )


def _serialize(a):
    return {
        "id":            a.id,
        "task_id":       a.task_id,
        "original_name": a.original_name,
        "mime_type":     a.mime_type,
        "file_size":     a.file_size,
        "uploaded_by":   a.uploaded_by,
        "uploader_name": a.uploader.username if a.uploader else None,
        "uploaded_at":   iso_utc(a.uploaded_at),
    }


def _announce(task):
    ws = workspace_id_for_task(task)
    if ws:
        from views.realtime import emit_task_updated
        emit_task_updated(ws, serialize_task(task))


@attachments_bp.route("/tasks/<int:task_id>/attachments", methods=["POST"])
@jwt_required()
def upload_attachment(task_id):
    user, task = _load_task(task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404

    file = request.files.get("file")
    if file is None or not file.filename:
        return jsonify({"error": "No file provided"}), 400

    original_name = secure_filename(file.filename)
    if not original_name or not _ext(original_name) in ALLOWED_EXTENSIONS:
        return jsonify({
            "error": f"File type not allowed. Accepted: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        }), 400

    data = file.read(MAX_FILE_SIZE + 1)
    if len(data) > MAX_FILE_SIZE:
        return jsonify({"error": f"File too large. Maximum {MAX_FILE_SIZE // (1024 * 1024)} MB."}), 400
    if not data:
        return jsonify({"error": "File is empty"}), 400

    if TaskAttachment.query.filter_by(task_id=task_id).count() >= MAX_PER_TASK:
        return jsonify({"error": f"Maximum {MAX_PER_TASK} attachments per task."}), 400

    stored = f"{uuid4().hex}.{_ext(original_name)}"
    path = os.path.join(attachment_dir(), stored)
    with open(path, "wb") as fh:
        fh.write(data)

    attachment = TaskAttachment(
        task_id=task_id,
        uploaded_by=user.id,
        filename=stored,
        original_name=original_name,
        mime_type=mimetypes.guess_type(original_name)[0] or "application/octet-stream",
        file_size=len(data),
    )
    db.session.add(attachment)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        remove_files(attachment_dir(), [stored])  # don't leave an orphan behind
        raise

    logger.info("attachment_uploaded", task_id=task_id, user_id=user.id, size=len(data))
    _announce(task)
    return jsonify(_serialize(attachment)), 201


@attachments_bp.route("/tasks/<int:task_id>/attachments", methods=["GET"])
@jwt_required()
def list_attachments(task_id):
    _, task = _load_task(task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404

    attachments = (
        TaskAttachment.query.filter_by(task_id=task_id).order_by(TaskAttachment.uploaded_at.asc()).all()
    )
    return jsonify([_serialize(a) for a in attachments]), 200


@attachments_bp.route("/tasks/attachments/<int:attachment_id>/download", methods=["GET"])
@jwt_required()
def download_attachment(attachment_id):
    user = current_user()
    attachment = db.session.get(TaskAttachment, attachment_id)
    task = db.session.get(Task, attachment.task_id) if attachment else None
    if not user or not task or not can_access_task(user, task):
        return jsonify({"error": "Attachment not found"}), 404

    response = send_from_directory(
        attachment_dir(), attachment.filename, as_attachment=True, download_name=attachment.original_name,
    )
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


@attachments_bp.route("/tasks/<int:task_id>/attachments/<int:attachment_id>", methods=["DELETE"])
@jwt_required()
def delete_attachment(task_id, attachment_id):
    user, task = _load_task(task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404

    attachment = TaskAttachment.query.filter_by(id=attachment_id, task_id=task_id).first()
    if not attachment:
        return jsonify({"error": "Attachment not found"}), 404
    if not _can_delete(attachment, task, user):
        return jsonify({"error": "Unauthorized"}), 403

    stored = attachment.filename
    db.session.delete(attachment)
    db.session.commit()
    remove_files(attachment_dir(), [stored])

    logger.info("attachment_deleted", attachment_id=attachment_id, user_id=user.id)
    _announce(task)
    return jsonify({"message": "Attachment deleted"}), 200
