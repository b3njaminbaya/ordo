from flask import Blueprint, request, make_response, jsonify, current_app, send_from_directory
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename
from models import db, User, Workspace, WorkspaceInvite
from flask_mail import Message
from functools import wraps
import secrets
import os
import uuid

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp"}

def _allowed(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

user_bp = Blueprint("user_bp", __name__)

# Admin access decorator
def admin_required(fn):
    @jwt_required()
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user_id = get_jwt_identity()
        current_user = db.session.get(User, user_id)

        if not current_user or current_user.role != "admin":
            return make_response({"error": "Admin access required"}), 403

        return fn(*args, **kwargs)

    return wrapper

# Get all users (Admin only)
@user_bp.route("/users", methods=["GET"])
@admin_required
def get_users():
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 10, type=int)

    users = User.query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        "users": [
            {"id": user.id, "username": user.username, "email": user.email, "role": user.role}
            for user in users.items
        ],
        "total": users.total,
        "pages": users.pages,
        "current_page": users.page,
        "next_page": users.next_num if users.has_next else None,
        "prev_page": users.prev_num if users.has_prev else None
    }), 200

# Get a specific user by ID
@user_bp.route("/users/<int:user_id>", methods=["GET"])
@jwt_required()
def get_user(user_id):
    user = db.session.get(User, user_id)
    if not user:
        return make_response({"error": "User not found"}), 404

    return make_response({
        "id": user.id,
        "username": user.username,
        "email": user.email
    }), 200

# Update user profile
@user_bp.route("/users/updateprofile", methods=["PATCH"])
@jwt_required()
def update_user():
    user_id = get_jwt_identity()
    user = db.session.get(User, user_id)  

    if not user:
        return make_response({"error": "User not found"}), 404  

    data = request.get_json()
    username = data.get("username", user.username)
    email = data.get("email", user.email)

    # Ensure new email is unique
    if email != user.email and User.query.filter_by(email=email).first():
        return make_response({"error": "Email already in use"}), 400

    user.username = username
    user.email = email

    db.session.commit()
    return make_response({"success": "User updated successfully"}), 200

# Upload profile picture
@user_bp.route("/users/profile-picture", methods=["POST"])
@jwt_required()
def upload_profile_picture():
    user_id = get_jwt_identity()
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if file.filename == "" or not _allowed(file.filename):
        return jsonify({"error": "Invalid file type. Use PNG, JPG, GIF, or WebP."}), 400

    if len(file.read()) > 5 * 1024 * 1024:
        return jsonify({"error": "File too large. Maximum 5 MB."}), 400
    file.seek(0)

    upload_dir = os.path.join(current_app.root_path, "uploads")
    os.makedirs(upload_dir, exist_ok=True)

    # Remove old picture
    if user.profile_picture:
        old_path = os.path.join(upload_dir, user.profile_picture)
        if os.path.exists(old_path):
            os.remove(old_path)

    ext = secure_filename(file.filename).rsplit(".", 1)[1].lower()
    filename = f"{uuid.uuid4().hex}.{ext}"
    file.save(os.path.join(upload_dir, filename))

    user.profile_picture = filename
    db.session.commit()

    base_url = current_app.config.get("FRONTEND_URL", request.host_url.rstrip("/"))
    return jsonify({"profile_picture_url": f"/uploads/{filename}"}), 200


# Serve uploaded files
@user_bp.route("/uploads/<path:filename>", methods=["GET"])
def serve_upload(filename):
    upload_dir = os.path.join(current_app.root_path, "uploads")
    return send_from_directory(upload_dir, filename)


# Change password
@user_bp.route("/users/change-password", methods=["PATCH"])
@jwt_required()
def change_password():
    user_id = get_jwt_identity()
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json()
    current_password = data.get("current_password", "")
    new_password = data.get("new_password", "")

    if not current_password or not new_password:
        return jsonify({"error": "Both current and new password are required"}), 400
    if not check_password_hash(user.password, current_password):
        return jsonify({"error": "Current password is incorrect"}), 400
    if len(new_password) < 6:
        return jsonify({"error": "New password must be at least 6 characters"}), 400

    user.password = generate_password_hash(new_password)
    db.session.commit()
    return jsonify({"success": "Password updated successfully"}), 200


# Toggle notifications
@user_bp.route("/users/notifications", methods=["PATCH"])
@jwt_required()
def toggle_notifications():
    user_id = get_jwt_identity()
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json()
    enabled = data.get("notifications_enabled")
    if enabled is None:
        return jsonify({"error": "notifications_enabled field required"}), 400

    user.notifications_enabled = bool(enabled)
    db.session.commit()
    return jsonify({"success": "Notification preference updated", "notifications_enabled": user.notifications_enabled}), 200


# Delete user account
@user_bp.route("/users/deleteaccount", methods=["DELETE"])
@jwt_required()
def delete_user():
    user_id = get_jwt_identity()
    user = db.session.get(User, user_id)  

    if not user:
        return make_response({"error": "User not found"}), 404  

    db.session.delete(user)
    db.session.commit()

    return make_response({"success": "Account deleted successfully"}), 200

# Invite a user to a workspace
@user_bp.route("/invite", methods=["POST"])
@jwt_required()
def invite_user():
    data = request.get_json()
    email = data.get("email")
    workspace_id = data.get("workspace_id")  

    if not email or not workspace_id:
        return jsonify({"error": "Email and workspace_id are required"}), 400

    user_id = get_jwt_identity()
    inviter = db.session.get(User, user_id)

    if not inviter:
        return jsonify({"error": "Invalid user"}), 404

    workspace = db.session.get(Workspace, workspace_id)

    if not workspace:
        return jsonify({"error": "Workspace not found"}), 404

    if inviter.workspace_id != workspace.id:
        return jsonify({"error": "You are not a member of this workspace"}), 403
    
    existing_invite = WorkspaceInvite.query.filter_by(email=email, workspace_id=workspace.id).first()
    if existing_invite and existing_invite.status == "pending":
        return jsonify({"error": "Invite already sent"}), 400

    invite_token = secrets.token_urlsafe(32)
    invite = WorkspaceInvite(email=email, workspace_id=workspace.id, invited_by=inviter.id, token=invite_token)
    
    db.session.add(invite)
    db.session.commit()

    frontend_url = current_app.config.get("FRONTEND_URL", "https://taskly-app-iota.vercel.app")
    invite_url = f"{frontend_url}/invite/{invite_token}"

    email_sent = False
    try:
        from app import mail as app_mail
        msg = Message("Workspace Invitation", recipients=[email])
        msg.body = f"You've been invited to join {workspace.name}.\nClick here to accept: {invite_url}"
        app_mail.send(msg)
        email_sent = True
    except Exception as e:
        current_app.logger.error("Email send failed: %s", e)

    return jsonify({
        "message": "Invite created successfully",
        "email_sent": email_sent,
        "invite_url": invite_url,
    }), 200

# Accept an invite to a workspace
@user_bp.route("/invite/accept/<string:token>", methods=["POST"])
@jwt_required()
def accept_invite(token):
    invite = WorkspaceInvite.query.filter_by(token=token, status="pending").first()

    if not invite:
        return jsonify({"error": "Invalid or expired invite"}), 404

    user_id = get_jwt_identity()
    user = db.session.get(User, user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    user.workspace_id = invite.workspace_id  
    invite.status = "accepted"

    db.session.commit()

    return jsonify({"message": "Joined workspace successfully!"}), 200

# Get workspace members
@user_bp.route("/workspace/<string:workspace_id>/members", methods=["GET"])
@jwt_required()
def get_workspace_members(workspace_id):
    workspace = db.session.get(Workspace, workspace_id)

    if not workspace:
        return jsonify({"error": "Workspace not found"}), 404

    members = User.query.filter_by(workspace_id=workspace.id).all()
    invites = WorkspaceInvite.query.filter_by(workspace_id=workspace.id, status="pending").all()

    return jsonify({
        "members": [{"id": m.id, "username": m.username, "email": m.email} for m in members],
        "pending_invites": [
            {
                "email": i.email,
                "invited_by": db.session.get(User, i.invited_by).username  
            }
            for i in invites
        ]
    }), 200


@user_bp.route("/invite/generate-link", methods=["POST"])
@jwt_required()
def generate_invite_link():
    data = request.get_json()
    workspace_id = data.get("workspace_id")

    if not workspace_id:
        return jsonify({"error": "workspace_id is required"}), 400

    user_id = get_jwt_identity()
    user = db.session.get(User, user_id)

    if not user or user.workspace_id != workspace_id:
        return jsonify({"error": "Unauthorized to generate invite link"}), 403

    workspace = db.session.get(Workspace, workspace_id)
    if not workspace:
        return jsonify({"error": "Workspace not found"}), 404

    existing_invite = WorkspaceInvite.query.filter_by(workspace_id=workspace_id, status="active").first()

    if existing_invite:
        invite_token = existing_invite.token
    else:
        invite_token = secrets.token_urlsafe(32)
        invite = WorkspaceInvite(
            email="link-invite",
            workspace_id=workspace_id,
            invited_by=int(get_jwt_identity()),
            token=invite_token,
            status="active",
        )
        db.session.add(invite)
        db.session.commit()

    frontend_url = current_app.config.get("FRONTEND_URL", "https://taskly-app-iota.vercel.app")
    invite_url = f"{frontend_url}/invite/{invite_token}"
    return jsonify({"link": invite_url}), 200
