"""Tenant-isolation helpers.

A "tenant" is a workspace. Every task list is owned by one user, and a task list
(and everything inside it) is visible to every member of its owner's workspace.
A user with no workspace can only see their own lists.
"""
from flask_jwt_extended import get_jwt_identity

from models import db, User, Workspace, Task, TaskList


def current_user():
    try:
        return db.session.get(User, int(get_jwt_identity()))
    except (TypeError, ValueError):
        return None


def workspace_member_ids(owner_id):
    """IDs of every user who shares a workspace with `owner_id` (including them)."""
    owner = db.session.get(User, owner_id)
    if owner is None:
        return []
    if not owner.workspace_id:
        return [owner.id]
    return [row[0] for row in db.session.query(User.id).filter_by(workspace_id=owner.workspace_id)]


def same_workspace(user, owner_id):
    """True if `user` may see resources owned by `owner_id`."""
    if owner_id == user.id:
        return True
    if not user.workspace_id:
        return False
    owner = db.session.get(User, owner_id)
    return owner is not None and owner.workspace_id == user.workspace_id


def can_access_tasklist(user, tasklist):
    return tasklist is not None and same_workspace(user, tasklist.user_id)


def can_access_task(user, task):
    return task is not None and can_access_tasklist(user, task.tasklist)


def workspace_id_for_owner(owner_id):
    owner = db.session.get(User, owner_id)
    return owner.workspace_id if owner else None


def workspace_id_for_task(task):
    return workspace_id_for_owner(task.tasklist.user_id)


def is_workspace_owner(user, workspace_id=None):
    ws = db.session.get(Workspace, workspace_id or user.workspace_id) if (workspace_id or user.workspace_id) else None
    return ws is not None and ws.owner_id == user.id


def _visible_owner_filter(user):
    if user.workspace_id:
        member_ids = db.session.query(User.id).filter_by(workspace_id=user.workspace_id)
        return TaskList.user_id.in_(member_ids)
    return TaskList.user_id == user.id


def visible_tasklist_query(user):
    return TaskList.query.filter(TaskList.is_template.isnot(True), _visible_owner_filter(user))


def visible_task_query(user, include_subtasks=False):
    q = (
        Task.query
        .join(TaskList, Task.tasklist_id == TaskList.id)
        .filter(TaskList.is_template.isnot(True), _visible_owner_filter(user))
    )
    if not include_subtasks:
        q = q.filter(Task.parent_task_id.is_(None))
    return q


def unique_workspace_name(base):
    """Workspace names are unique; add a numeric suffix if `base` is taken."""
    name, n = base, 1
    while Workspace.query.filter_by(name=name).first() is not None:
        n += 1
        name = f"{base} ({n})"
    return name[:100]
