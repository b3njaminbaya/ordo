import hashlib
import uuid
from datetime import timedelta

import structlog
from flask import Blueprint, current_app, jsonify
from flask_jwt_extended import (
    create_access_token, create_refresh_token, decode_token,
    get_jwt, get_jwt_identity, jwt_required,
)
from flask_mail import Message
from sqlalchemy.exc import IntegrityError
from werkzeug.security import check_password_hash, generate_password_hash

from access import unique_workspace_name
from extensions import limiter
from models import db, TaskList, TokenBlocklist, User, Workspace
from validation import (
    json_body, normalize_email, utcnow_naive,
    validate_email, validate_password, validate_username,
)

auth_bp = Blueprint("auth_bp", __name__)
logger = structlog.get_logger()

DEFAULT_LIST_NAME = "My Tasks"


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def user_payload(user):
    """The one shape used for session, login and registration responses."""
    workspace = db.session.get(Workspace, user.workspace_id) if user.workspace_id else None
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "notifications_enabled": True if user.notifications_enabled is None else bool(user.notifications_enabled),
        "profile_picture": f"/uploads/{user.profile_picture}" if user.profile_picture else None,
        "workspace_id": user.workspace_id,
        "workspace": {
            "id": workspace.id if workspace else None,
            "name": workspace.name if workspace else "No Workspace",
            "owner_id": workspace.owner_id if workspace else None,
            "is_owner": bool(workspace and workspace.owner_id == user.id),
        },
    }


def issue_tokens(user):
    identity = str(user.id)
    return {
        "access_token": create_access_token(identity=identity),
        "refresh_token": create_refresh_token(identity=identity),
    }


def create_personal_workspace(user):
    """Give `user` a fresh workspace of their own with a starter list. Caller commits."""
    workspace = Workspace(name=unique_workspace_name(f"{user.username}'s Workspace"), owner_id=user.id)
    db.session.add(workspace)
    db.session.flush()
    user.workspace_id = workspace.id
    db.session.add(TaskList(name=DEFAULT_LIST_NAME, user_id=user.id))
    return workspace


@auth_bp.route("/register", methods=["POST"])
@limiter.limit("5 per minute")
def add_user():
    data = json_body()
    username = (data.get("username") or "").strip() if isinstance(data.get("username"), str) else ""
    email = normalize_email(data.get("email"))
    password = data.get("password")

    if not username or not email or not password:
        return jsonify({"error": "All fields are required"}), 400
    for err in (validate_username(username), validate_email(email), validate_password(password)):
        if err:
            return jsonify({"error": err}), 400

    if User.query.filter(db.func.lower(User.username) == username.lower()).first():
        return jsonify({"error": "Username already exists"}), 409
    if User.query.filter(db.func.lower(User.email) == email).first():
        return jsonify({"error": "Email already exists"}), 409

    try:
        user = User(username=username, email=email, password=generate_password_hash(password))
        db.session.add(user)
        db.session.flush()
        create_personal_workspace(user)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "Username or email already exists"}), 409

    logger.info("user_registered", user_id=user.id)
    return jsonify({
        "success": "User registered successfully",
        **issue_tokens(user),
        "user": user_payload(user),
    }), 201


@auth_bp.route("/session", methods=["GET"])
@jwt_required()
def check_session():
    user = db.session.get(User, int(get_jwt_identity()))
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    return jsonify({"user": user_payload(user)})


@auth_bp.route("/login", methods=["POST"])
@limiter.limit("10 per minute")
def login():
    data = json_body()
    identifier = data.get("identifier")
    password = data.get("password")

    if not isinstance(identifier, str) or not isinstance(password, str) or not identifier or not password:
        return jsonify({"error": "Username/Email and password are required"}), 400

    identifier = identifier.strip()
    user = User.query.filter(
        (db.func.lower(User.email) == identifier.lower()) | (User.username == identifier)
    ).first()

    if user and check_password_hash(user.password, password):
        logger.info("user_login", user_id=user.id)
        return jsonify({**issue_tokens(user), "user": user_payload(user)}), 200

    logger.warning("login_failed")
    return jsonify({"error": "Invalid email or password"}), 400


@auth_bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    return jsonify({"access_token": create_access_token(identity=get_jwt_identity())}), 200


@auth_bp.route("/profile", methods=["GET"])
@jwt_required()
def user_profile():
    user = db.session.get(User, int(get_jwt_identity()))
    if user:
        return jsonify({"username": user.username, "email": user.email}), 200
    return jsonify({"error": "User doesn't exist"}), 404


def _revoke(jti):
    if not TokenBlocklist.query.filter_by(jti=jti).first():
        db.session.add(TokenBlocklist(jti=jti, created_at=utcnow_naive()))


@auth_bp.route("/logout", methods=["DELETE"])
@jwt_required()
def logout():
    """Revoke the access token and, if supplied, the matching refresh token."""
    _revoke(get_jwt()["jti"])

    refresh_token = json_body().get("refresh_token")
    if isinstance(refresh_token, str) and refresh_token:
        try:
            decoded = decode_token(refresh_token)
            if decoded.get("sub") == get_jwt_identity() and decoded.get("type") == "refresh":
                _revoke(decoded["jti"])
        except Exception:  # noqa: BLE001 — an already-invalid refresh token needs no revoking
            pass

    db.session.commit()
    logger.info("user_logout", user_id=get_jwt_identity())
    return jsonify({"success": "Logged out successfully"}), 200


@auth_bp.route("/forgot-password", methods=["POST"])
@limiter.limit("3 per minute")
def forgot_password():
    email = normalize_email(json_body().get("email"))
    generic = {"message": "If that email is registered, a reset link has been sent"}

    user = User.query.filter(db.func.lower(User.email) == email).first() if email else None
    if not user:
        return jsonify(generic), 200

    raw_token = str(uuid.uuid4())
    user.reset_token = _hash_token(raw_token)
    user.token_expiry = utcnow_naive() + timedelta(hours=1)
    db.session.commit()

    try:
        send_reset_email(user, raw_token)
        logger.info("password_reset_requested", user_id=user.id)
    except Exception as e:  # noqa: BLE001
        # Same response either way: a different one would reveal that the address exists.
        logger.error("password_reset_email_failed", user_id=user.id, error=str(e))

    return jsonify(generic), 200


@auth_bp.route("/reset-password/<token>", methods=["POST"])
@limiter.limit("10 per minute")
def reset_password(token):
    new_password = json_body().get("new_password")
    err = validate_password(new_password)
    if err:
        return jsonify({"error": err}), 400

    user = User.query.filter_by(reset_token=_hash_token(token)).first()
    if not user or not user.token_expiry or user.token_expiry < utcnow_naive():
        return jsonify({"error": "Invalid or expired token"}), 400

    user.password = generate_password_hash(new_password)
    user.reset_token = None
    user.token_expiry = None
    user.password_changed_at = utcnow_naive().replace(microsecond=0)  # signs out every other session
    db.session.commit()
    logger.info("password_reset_complete", user_id=user.id)
    return jsonify({"success": "Password updated successfully"}), 200


def send_reset_email(user, token):
    reset_url = f"{current_app.config['FRONTEND_URL']}/reset-password/{token}"
    from app import mail as app_mail
    msg = Message("Ordo – Password Reset Request", recipients=[user.email])
    msg.body = (
        f"Click the following link to reset your Ordo password: {reset_url}\n"
        "This link expires in 1 hour.\n"
        "If you did not request this, please ignore this email.\n\n"
        "— The Ordo Team"
    )
    app_mail.send(msg)
