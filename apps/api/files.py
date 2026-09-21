"""Filesystem helpers for uploaded files."""
import os

import structlog
from flask import current_app

logger = structlog.get_logger()


def upload_root():
    path = os.path.join(current_app.root_path, "uploads")
    os.makedirs(path, exist_ok=True)
    return path


def attachment_dir():
    path = os.path.join(upload_root(), "task_attachments")
    os.makedirs(path, exist_ok=True)
    return path


def remove_files(directory, filenames):
    """Best-effort delete; a missing file is not an error."""
    for name in filenames:
        if not name or os.path.basename(name) != name:
            continue
        try:
            os.remove(os.path.join(directory, name))
        except FileNotFoundError:
            pass
        except OSError as exc:  # pragma: no cover - disk problems
            logger.warning("file_remove_failed", file=name, error=str(exc))


def image_extension(head: bytes):
    """Detect an allowed image type from its magic bytes (never from the filename)."""
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if head.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if head.startswith((b"GIF87a", b"GIF89a")):
        return "gif"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "webp"
    return None


def attachment_filenames_for_lists(list_ids):
    """Stored filenames of every attachment on tasks in the given lists."""
    from models import db, Task, TaskAttachment
    if not list_ids:
        return []
    rows = (
        db.session.query(TaskAttachment.filename)
        .join(Task, TaskAttachment.task_id == Task.id)
        .filter(Task.tasklist_id.in_(list_ids))
        .all()
    )
    return [r[0] for r in rows]


def attachment_filenames_for_tasks(task_ids):
    from models import db, TaskAttachment
    if not task_ids:
        return []
    return [r[0] for r in db.session.query(TaskAttachment.filename).filter(TaskAttachment.task_id.in_(task_ids))]
