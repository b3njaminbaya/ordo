"""Moving users between workspaces without losing or leaking team data.

Rule: task lists belong to the workspace they were created in. When a user
leaves (or is removed, or deletes their account) and other members remain, their
lists stay behind with the workspace's owner. If they were the only member, the
lists simply go with them.
"""
from models import db, TaskAssignment, TaskList, User, Workspace


def other_members(user):
    if not user.workspace_id:
        return []
    return (
        User.query.filter(User.workspace_id == user.workspace_id, User.id != user.id)
        .order_by(User.id)
        .all()
    )


def hand_over_workspace(user):
    """Leave `user`'s current workspace's data with the people staying behind.

    Returns True if other members remain (so `user` should get a fresh workspace
    rather than taking the lists along). Caller commits.
    """
    remaining = other_members(user)
    if not remaining:
        return False

    workspace = db.session.get(Workspace, user.workspace_id)
    if workspace.owner_id == user.id or workspace.owner_id not in {m.id for m in remaining}:
        workspace.owner_id = remaining[0].id
    heir_id = workspace.owner_id

    TaskList.query.filter_by(user_id=user.id).update({"user_id": heir_id}, synchronize_session=False)
    TaskAssignment.query.filter_by(user_id=user.id).delete(synchronize_session=False)
    db.session.expire(user, ["tasklists", "tasks_assigned"])
    return True
