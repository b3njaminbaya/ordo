import os
import mimetypes
import structlog
from uuid import uuid4

from flask import Blueprint, request, jsonify, current_app, send_from_directory
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename

from models import db, Task, User, TaskAttachment

logger = structlog.get_logger()

attachments_bp = Blueprint("attachments_bp", __name__)

ALLOWED_EXTENSIONS = {
    # Images
    "png", "jpg", "jpeg", "gif", "webp", "svg",
    # Documents
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
    "txt", "md", "csv",
    # Archives
    "zip",
}
MAX_FILE_SIZE       = 10 * 1024 * 1024   # 10 MB
MAX_PER_TASK        = 10


def _ext(filename):
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


def _allowed(filename):
    return _ext(filename) in ALLOWED_EXTENSIONS


def _get_user():
    return db.session.get(User, int(get_jwt_identity()))


def _upload_dir():
    d = os.path.join(current_app.root_path, "uploads", "task_attachments")
    os.makedirs(d, exist_ok=True)
    return d


def _can_access(task, user):
    """Any workspace member of the task owner can view/upload."""
    owner = db.session.get(User, task.tasklist.user_id)
    return owner and owner.workspace_id == user.workspace_id


def _can_delete(attachment, task, user):
    """Uploader or task-list owner can delete."""
    return attachment.uploaded_by == user.id or task.tasklist.user_id == user.id


def _serialize(a):
    return {
        "id":            a.id,
        "task_id":       a.task_id,
        "original_name": a.original_name,
        "mime_type":     a.mime_type,
        "file_size":     a.file_size,
        "uploaded_by":   a.uploaded_by,
        "uploader_name": a.uploader.username if a.uploader else None,
        "uploaded_at":   a.uploaded_at.isoformat() if a.uploaded_at else None,
    }


# ── Upload ────────────────────────────────────────────────────────────────────

@attachments_bp.route("/tasks/<int:task_id>/attachments", methods=["POST"])
@jwt_required()
def upload_attachment(task_id):
    user = _get_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    task = db.session.get(Task, task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404

    if not _can_access(task, user):
        return jsonify({"error": "Unauthorized"}), 403

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "Empty filename"}), 400

    original_name = secure_filename(file.filename)
    if not _allowed(original_name):
        return jsonify({
            "error": f"File type not allowed. Accepted: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        }), 400

    data = file.read()
    if len(data) > MAX_FILE_SIZE:
        return jsonify({"error": f"File too large. Maximum {MAX_FILE_SIZE // (1024*1024)} MB."}), 400
    if len(data) == 0:
        return jsonify({"error": "File is empty"}), 400
    file.seek(0)

    if TaskAttachment.query.filter_by(task_id=task_id).count() >= MAX_PER_TASK:
        return jsonify({"error": f"Maximum {MAX_PER_TASK} attachments per task."}), 400

    ext      = _ext(original_name)
    stored   = f"{uuid4().hex}.{ext}"
    mime     = mimetypes.guess_type(original_name)[0] or "application/octet-stream"
    size     = len(data)

    file.save(os.path.join(_upload_dir(), stored))

    attachment = TaskAttachment(
        task_id=task_id,
        uploaded_by=user.id,
        filename=stored,
        original_name=original_name,
        mime_type=mime,
        file_size=size,
    )
    db.session.add(attachment)
    db.session.commit()

    logger.info("attachment_uploaded", task_id=task_id, user_id=user.id, name=original_name, size=size)
    return jsonify(_serialize(attachment)), 201


# ── List ──────────────────────────────────────────────────────────────────────

@attachments_bp.route("/tasks/<int:task_id>/attachments", methods=["GET"])
@jwt_required()
def list_attachments(task_id):
    user = _get_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    task = db.session.get(Task, task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404

    if not _can_access(task, user):
        return jsonify({"error": "Unauthorized"}), 403

    attachments = (
        TaskAttachment.query
        .filter_by(task_id=task_id)
        .order_by(TaskAttachment.uploaded_at.asc())
        .all()
    )
    return jsonify([_serialize(a) for a in attachments]), 200


# ── Download (authenticated) ──────────────────────────────────────────────────

@attachments_bp.route("/tasks/attachments/<int:attachment_id>/download", methods=["GET"])
@jwt_required()
def download_attachment(attachment_id):
    user = _get_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    attachment = db.session.get(TaskAttachment, attachment_id)
    if not attachment:
        return jsonify({"error": "Attachment not found"}), 404

    task = db.session.get(Task, attachment.task_id)
    if not task or not _can_access(task, user):
        return jsonify({"error": "Unauthorized"}), 403

    return send_from_directory(
        _upload_dir(),
        attachment.filename,
        as_attachment=True,
        download_name=attachment.original_name,
    )


# ── Delete ────────────────────────────────────────────────────────────────────

@attachments_bp.route("/tasks/<int:task_id>/attachments/<int:attachment_id>", methods=["DELETE"])
@jwt_required()
def delete_attachment(task_id, attachment_id):
    user = _get_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    task = db.session.get(Task, task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404

    attachment = TaskAttachment.query.filter_by(id=attachment_id, task_id=task_id).first()
    if not attachment:
        return jsonify({"error": "Attachment not found"}), 404

    if not _can_delete(attachment, task, user):
        return jsonify({"error": "Unauthorized"}), 403

    # Remove file from disk
    path = os.path.join(_upload_dir(), attachment.filename)
    if os.path.exists(path):
        os.remove(path)

    db.session.delete(attachment)
    db.session.commit()

    logger.info("attachment_deleted", attachment_id=attachment_id, user_id=user.id)
    return jsonify({"message": "Attachment deleted"}), 200
