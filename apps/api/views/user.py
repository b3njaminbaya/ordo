import os
import re
import secrets
import uuid
from datetime import timedelta
from functools import wraps

import structlog
from flask import Blueprint, abort, current_app, jsonify, request, send_from_directory
from flask_jwt_extended import jwt_required
from flask_mail import Message
from sqlalchemy.exc import IntegrityError
from werkzeug.security import check_password_hash, generate_password_hash

from access import current_user, is_workspace_owner, same_workspace
from files import (
    attachment_dir, attachment_filenames_for_lists, image_extension, remove_files, upload_root,
)
from models import (
    db, TaskList, User, Workspace, WorkspaceInvite,
)
from validation import (
    json_body, normalize_email, utcnow_naive, validate_email, validate_password, validate_username,
)
from views.auth import create_personal_workspace, issue_tokens, user_payload
from workspace_service import hand_over_workspace, other_members, prune_if_empty

logger = structlog.get_logger()
user_bp = Blueprint("user_bp", __name__)

MAX_AVATAR_BYTES = 5 * 1024 * 1024
EMAIL_INVITE_TTL = timedelta(days=7)
LINK_INVITE_TTL = timedelta(days=14)
_UPLOAD_NAME_RE = re.compile(r"^[a-f0-9]{32}\.(png|jpg|jpeg|gif|webp)$")


def admin_required(fn):
    @jwt_required()
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = current_user()
        if not user or user.role != "admin":
            return jsonify({"error": "Admin access required"}), 403
        return fn(*args, **kwargs)
    return wrapper


# ── Users ─────────────────────────────────────────────────────────────────────

@user_bp.route("/users", methods=["GET"])
@admin_required
def get_users():
    page = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("per_page", 10, type=int), 100)
    users = User.query.order_by(User.id).paginate(page=page, per_page=per_page, error_out=False)
    return jsonify({
        "users": [
            {"id": u.id, "username": u.username, "email": u.email, "role": u.role}
            for u in users.items
        ],
        "total": users.total,
        "pages": users.pages,
        "current_page": users.page,
        "next_page": users.next_num if users.has_next else None,
        "prev_page": users.prev_num if users.has_prev else None,
    }), 200


@user_bp.route("/users/<int:user_id>", methods=["GET"])
@jwt_required()
def get_user(user_id):
    me = current_user()
    target = db.session.get(User, user_id)
    # Only people you share a workspace with are visible; anyone else looks like "not found".
    if not me or not target or not same_workspace(me, target.id):
        return jsonify({"error": "User not found"}), 404
    return jsonify({"id": target.id, "username": target.username, "email": target.email}), 200


@user_bp.route("/users/updateprofile", methods=["PATCH"])
@jwt_required()
def update_user():
    user = current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = json_body()
    username = data.get("username", user.username)
    email = normalize_email(data.get("email", user.email))
    username = username.strip() if isinstance(username, str) else username

    if username != user.username:
        err = validate_username(username)
        if err:
            return jsonify({"error": err}), 400
        if User.query.filter(db.func.lower(User.username) == username.lower(), User.id != user.id).first():
            return jsonify({"error": "Username already in use"}), 409
    if email != user.email.lower():
        err = validate_email(email)
        if err:
            return jsonify({"error": err}), 400
        if User.query.filter(db.func.lower(User.email) == email, User.id != user.id).first():
            return jsonify({"error": "Email already in use"}), 409
    else:
        email = user.email

    user.username = username
    user.email = email
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "Username or email already in use"}), 409
    return jsonify({"success": "User updated successfully", "user": user_payload(user)}), 200


@user_bp.route("/users/profile-picture", methods=["POST"])
@jwt_required()
def upload_profile_picture():
    user = current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    file = request.files.get("file")
    if file is None or not file.filename:
        return jsonify({"error": "No file provided"}), 400

    data = file.read(MAX_AVATAR_BYTES + 1)
    if len(data) > MAX_AVATAR_BYTES:
        return jsonify({"error": "File too large. Maximum 5 MB."}), 400
    ext = image_extension(data[:16])
    if ext is None:
        return jsonify({"error": "Invalid file type. Use PNG, JPG, GIF, or WebP."}), 400

    filename = f"{uuid.uuid4().hex}.{ext}"
    with open(os.path.join(upload_root(), filename), "wb") as fh:
        fh.write(data)

    old = user.profile_picture
    user.profile_picture = filename
    db.session.commit()
    if old:
        remove_files(upload_root(), [old])

    return jsonify({"profile_picture_url": f"/uploads/{filename}"}), 200


@user_bp.route("/uploads/<path:filename>", methods=["GET"])
def serve_upload(filename):
    """Public avatars only (needed by <img> tags). Task attachments live in a
    subfolder and are only reachable through the authenticated download route."""
    if not _UPLOAD_NAME_RE.match(filename):
        abort(404)
    response = send_from_directory(upload_root(), filename)
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


@user_bp.route("/users/change-password", methods=["PATCH"])
@jwt_required()
def change_password():
    user = current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = json_body()
    current_password = data.get("current_password") or ""
    new_password = data.get("new_password") or ""

    if not current_password or not new_password:
        return jsonify({"error": "Both current and new password are required"}), 400
    if not check_password_hash(user.password, current_password):
        return jsonify({"error": "Current password is incorrect"}), 400
    err = validate_password(new_password)
    if err:
        return jsonify({"error": err}), 400

    user.password = generate_password_hash(new_password)
    user.password_changed_at = utcnow_naive().replace(microsecond=0)  # revokes every existing token
    db.session.commit()
    # Fresh tokens so this browser stays signed in; every other session is signed out.
    return jsonify({"success": "Password updated successfully", **issue_tokens(user)}), 200


@user_bp.route("/users/notifications", methods=["PATCH"])
@jwt_required()
def toggle_notifications():
    user = current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    enabled = json_body().get("notifications_enabled")
    if not isinstance(enabled, bool):
        return jsonify({"error": "notifications_enabled (true/false) is required"}), 400

    user.notifications_enabled = enabled
    db.session.commit()
    return jsonify({"success": "Notification preference updated", "notifications_enabled": enabled}), 200


@user_bp.route("/users/deleteaccount", methods=["DELETE"])
@jwt_required()
def delete_user():
    user = current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    if not check_password_hash(user.password, json_body().get("password") or ""):
        return jsonify({"error": "Password is incorrect"}), 400

    # Teammates keep the shared lists; a lone user's data is deleted with them.
    kept = hand_over_workspace(user)
    orphan_files = []
    if not kept:
        orphan_files = attachment_filenames_for_lists([tl.id for tl in TaskList.query.filter_by(user_id=user.id)])
    avatar = user.profile_picture
    old_workspace_id = user.workspace_id

    db.session.delete(user)
    prune_if_empty(old_workspace_id)     # nobody left in it → don't leave a stray row
    db.session.commit()

    remove_files(attachment_dir(), orphan_files)
    if avatar:
        remove_files(upload_root(), [avatar])
    return jsonify({"success": "Account deleted successfully"}), 200


# ── Workspace: members ────────────────────────────────────────────────────────

def _require_member(workspace_id):
    """(user, workspace, error_response) — error_response is set if access is denied."""
    user = current_user()
    if not user:
        return None, None, (jsonify({"error": "User not found"}), 404)
    workspace = db.session.get(Workspace, workspace_id)
    if not workspace or user.workspace_id != workspace.id:
        # Same answer for "doesn't exist" and "not yours".
        return None, None, (jsonify({"error": "Workspace not found"}), 404)
    return user, workspace, None


def _invite_expiry(invite):
    ttl = LINK_INVITE_TTL if invite.status == "active" else EMAIL_INVITE_TTL
    return (invite.created_at or utcnow_naive()) + ttl


def _invite_is_live(invite):
    return invite.status in ("pending", "active") and _invite_expiry(invite) > utcnow_naive()


@user_bp.route("/workspace/<string:workspace_id>/members", methods=["GET"])
@jwt_required()
def get_workspace_members(workspace_id):
    user, workspace, err = _require_member(workspace_id)
    if err:
        return err

    members = User.query.filter_by(workspace_id=workspace.id).order_by(User.id).all()
    member_emails = {m.email.lower() for m in members}
    invites = WorkspaceInvite.query.filter_by(workspace_id=workspace.id, status="pending").all()
    link = WorkspaceInvite.query.filter_by(workspace_id=workspace.id, status="active").first()

    inviters = {u.id: u.username for u in User.query.filter(User.id.in_({i.invited_by for i in invites}))} if invites else {}
    return jsonify({
        "owner_id": workspace.owner_id,
        "members": [
            {"id": m.id, "username": m.username, "email": m.email, "is_owner": m.id == workspace.owner_id}
            for m in members
        ],
        "pending_invites": [
            {
                "id": i.id,
                "email": i.email,
                "status": i.status,
                "invited_by": inviters.get(i.invited_by, "unknown"),
                "expires_at": _invite_expiry(i).isoformat() + "Z",
            }
            for i in invites
            if _invite_is_live(i) and i.email.lower() not in member_emails
        ],
        "has_active_link": bool(link and _invite_is_live(link)),
    }), 200


def _start_fresh_workspace(user):
    """Detach `user` from their workspace (leaving shared lists behind) and start a new one."""
    if not hand_over_workspace(user):
        # Alone in the workspace: nothing to leave behind, nothing to do.
        return False
    create_personal_workspace(user)
    return True


@user_bp.route("/workspace/<string:workspace_id>/leave", methods=["POST"])
@jwt_required()
def leave_workspace(workspace_id):
    user, workspace, err = _require_member(workspace_id)
    if err:
        return err
    if not other_members(user):
        return jsonify({"error": "You are the only member of this workspace"}), 400

    _start_fresh_workspace(user)
    db.session.commit()
    return jsonify({"message": "You left the workspace", "user": user_payload(user)}), 200


@user_bp.route("/workspace/<string:workspace_id>/members/<int:member_id>", methods=["DELETE"])
@jwt_required()
def remove_member(workspace_id, member_id):
    user, workspace, err = _require_member(workspace_id)
    if err:
        return err
    if workspace.owner_id != user.id:
        return jsonify({"error": "Only the workspace owner can remove members"}), 403
    if member_id == user.id:
        return jsonify({"error": "Use “Leave workspace” to remove yourself"}), 400

    member = db.session.get(User, member_id)
    if not member or member.workspace_id != workspace.id:
        return jsonify({"error": "Member not found"}), 404

    _start_fresh_workspace(member)
    db.session.commit()
    return jsonify({"message": "Member removed"}), 200


# ── Workspace: invites ────────────────────────────────────────────────────────

def _frontend_url():
    return current_app.config["FRONTEND_URL"]


@user_bp.route("/invite", methods=["POST"])
@jwt_required()
def invite_user():
    data = json_body()
    email = normalize_email(data.get("email"))
    workspace_id = data.get("workspace_id")

    if not email or not workspace_id:
        return jsonify({"error": "Email and workspace_id are required"}), 400
    err = validate_email(email)
    if err:
        return jsonify({"error": err}), 400

    inviter, workspace, denied = _require_member(workspace_id)
    if denied:
        return denied

    if User.query.filter(db.func.lower(User.email) == email, User.workspace_id == workspace.id).first():
        return jsonify({"error": "That person is already in this workspace"}), 400

    existing = WorkspaceInvite.query.filter(
        db.func.lower(WorkspaceInvite.email) == email,
        WorkspaceInvite.workspace_id == workspace.id,
        WorkspaceInvite.status == "pending",
    ).first()
    if existing and _invite_is_live(existing):
        return jsonify({"error": "Invite already sent"}), 400
    if existing:
        existing.status = "expired"

    invite = WorkspaceInvite(
        email=email, workspace_id=workspace.id, invited_by=inviter.id,
        token=secrets.token_urlsafe(32),
    )
    db.session.add(invite)
    db.session.commit()

    invite_url = f"{_frontend_url()}/invite/{invite.token}"
    email_sent, email_error = False, None
    try:
        from app import mail as app_mail
        msg = Message("Ordo – Workspace Invitation", recipients=[email])
        msg.body = (
            f"{inviter.username} invited you to join the '{workspace.name}' workspace on Ordo.\n"
            f"Click here to review and accept: {invite_url}\n"
            "This invitation expires in 7 days.\n\n"
            "— The Ordo Team"
        )
        app_mail.send(msg)
        email_sent = True
    except Exception as e:  # noqa: BLE001
        email_error = "The email could not be sent"
        logger.error("invite_email_failed", error=str(e))

    return jsonify({
        "message": "Invite created successfully",
        "id": invite.id,
        "email_sent": email_sent,
        "email_error": email_error,
        "invite_url": invite_url,
    }), 200


@user_bp.route("/invite/<int:invite_id>", methods=["DELETE"])
@jwt_required()
def revoke_invite(invite_id):
    user = current_user()
    invite = db.session.get(WorkspaceInvite, invite_id)
    if not user or not invite or invite.workspace_id != user.workspace_id:
        return jsonify({"error": "Invite not found"}), 404
    if not (invite.invited_by == user.id or is_workspace_owner(user)):
        return jsonify({"error": "Only the inviter or the workspace owner can revoke an invite"}), 403

    invite.status = "revoked"
    db.session.commit()
    return jsonify({"message": "Invite revoked"}), 200


@user_bp.route("/invite/preview/<string:token>", methods=["GET"])
def preview_invite(token):
    """What the invite page shows before anyone commits to joining."""
    invite = WorkspaceInvite.query.filter_by(token=token).first()
    if not invite or not _invite_is_live(invite):
        return jsonify({"error": "This invite link is invalid or has expired"}), 404
    workspace = db.session.get(Workspace, invite.workspace_id)
    inviter = db.session.get(User, invite.invited_by)
    return jsonify({
        "workspace_name": workspace.name if workspace else "a workspace",
        "invited_by": inviter.username if inviter else None,
        "member_count": User.query.filter_by(workspace_id=invite.workspace_id).count(),
    }), 200


@user_bp.route("/invite/accept/<string:token>", methods=["POST"])
@jwt_required()
def accept_invite(token):
    invite = WorkspaceInvite.query.filter(
        WorkspaceInvite.token == token,
        WorkspaceInvite.status.in_(["pending", "active"]),
    ).first()
    if not invite or not _invite_is_live(invite):
        return jsonify({"error": "Invalid or expired invite"}), 404

    user = current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    if user.workspace_id != invite.workspace_id:
        # Leave the old workspace's lists with its remaining members (if any).
        old_workspace_id = user.workspace_id
        hand_over_workspace(user)
        user.workspace_id = invite.workspace_id
        prune_if_empty(old_workspace_id)   # their personal workspace is now empty

    # Email invites are single-use; link invites stay open until they expire or are revoked.
    if invite.status == "pending":
        invite.status = "accepted"
    WorkspaceInvite.query.filter(
        db.func.lower(WorkspaceInvite.email) == user.email.lower(),
        WorkspaceInvite.workspace_id == invite.workspace_id,
        WorkspaceInvite.status == "pending",
    ).update({"status": "accepted"}, synchronize_session=False)

    db.session.commit()
    return jsonify({
        "message": "Joined workspace successfully!",
        "workspace_id": invite.workspace_id,
        "user": user_payload(user),
    }), 200


@user_bp.route("/invite/generate-link", methods=["POST"])
@jwt_required()
def generate_invite_link():
    workspace_id = json_body().get("workspace_id")
    if not workspace_id:
        return jsonify({"error": "workspace_id is required"}), 400

    user, workspace, denied = _require_member(workspace_id)
    if denied:
        return denied

    invite = WorkspaceInvite.query.filter_by(workspace_id=workspace.id, status="active").first()
    if invite and not _invite_is_live(invite):
        invite.status = "expired"
        invite = None
    if invite is None:
        invite = WorkspaceInvite(
            email="link-invite", workspace_id=workspace.id, invited_by=user.id,
            token=secrets.token_urlsafe(32), status="active",
        )
        db.session.add(invite)
        db.session.commit()

    return jsonify({
        "link": f"{_frontend_url()}/invite/{invite.token}",
        "expires_at": _invite_expiry(invite).isoformat() + "Z",
    }), 200


@user_bp.route("/invite/link", methods=["DELETE"])
@jwt_required()
def revoke_invite_link():
    user = current_user()
    if not user or not user.workspace_id:
        return jsonify({"error": "Workspace not found"}), 404
    WorkspaceInvite.query.filter_by(workspace_id=user.workspace_id, status="active").update(
        {"status": "revoked"}, synchronize_session=False
    )
    db.session.commit()
    return jsonify({"message": "Invite link revoked"}), 200
