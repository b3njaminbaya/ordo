import structlog
import uuid
import os
import hashlib

from flask import make_response, request, Blueprint, jsonify, current_app
from flask_jwt_extended import (
    create_access_token, create_refresh_token,
    jwt_required, get_jwt_identity, get_jwt,
)
from flask_mail import Message
from werkzeug.security import check_password_hash, generate_password_hash
from datetime import datetime, timezone, timedelta

from extensions import limiter
from models import db, User, TokenBlocklist, Workspace

auth_bp = Blueprint("auth_bp", __name__)
logger = structlog.get_logger()


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


@auth_bp.route("/register", methods=["POST"])
@limiter.limit("5 per minute")
def add_user():
    data = request.get_json()
    username = data.get("username")
    email = data.get("email")
    password = data.get("password")

    if not username or not email or not password:
        return make_response(jsonify({"error": "All fields are required"}), 400)

    if User.query.filter_by(username=username).first():
        return make_response(jsonify({"error": "Username already exists"}), 409)

    if User.query.filter_by(email=email).first():
        return make_response(jsonify({"error": "Email already exists"}), 409)

    hashed_password = generate_password_hash(password)

    try:
        workspace = Workspace(name=f"{username}'s Workspace")
        db.session.add(workspace)
        db.session.flush()

        new_user = User(username=username, email=email, password=hashed_password, workspace_id=workspace.id)
        db.session.add(new_user)
        db.session.commit()

        access_token = create_access_token(identity=str(new_user.id))
        refresh_token = create_refresh_token(identity=str(new_user.id))
        logger.info("user_registered", user_id=new_user.id, username=username)
        return make_response(jsonify({
            "success": "User registered successfully",
            "access_token": access_token,
            "refresh_token": refresh_token,
            "user": {
                "id": new_user.id,
                "username": new_user.username,
                "email": new_user.email,
                "workspace_id": new_user.workspace_id,
            },
        }), 201)

    except Exception as e:
        db.session.rollback()
        logger.error("registration_failed", error=str(e))
        return make_response(jsonify({"error": f"Registration failed: {str(e)}"}), 500)


@auth_bp.route("/session", methods=["GET"])
@jwt_required()
def check_session():
    user_id = get_jwt_identity()
    user = db.session.get(User, user_id)

    if user:
        workspace = db.session.get(Workspace, user.workspace_id)
        return jsonify({
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": user.role,
                "notifications_enabled": user.notifications_enabled,
                "profile_picture": f"/uploads/{user.profile_picture}" if user.profile_picture else None,
                "workspace_id": user.workspace_id,
                "workspace": {
                    "id": workspace.id if workspace else None,
                    "name": workspace.name if workspace else "No Workspace",
                },
            }
        })

    return jsonify({"error": "Unauthorized"}), 401


@auth_bp.route("/login", methods=["POST"])
@limiter.limit("10 per minute")
def login():
    data = request.get_json()
    identifier = data.get("identifier")
    password = data.get("password")

    if not identifier or not password:
        return make_response(jsonify({"error": "Username/Email and password are required"}), 400)

    user = User.query.filter(
        (User.email == identifier) | (User.username == identifier)
    ).first()

    if user and check_password_hash(user.password, password):
        access_token = create_access_token(identity=str(user.id))
        refresh_token = create_refresh_token(identity=str(user.id))
        logger.info("user_login", user_id=user.id, username=user.username)
        return make_response(jsonify({
            "access_token": access_token,
            "refresh_token": refresh_token,
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "workspace_id": user.workspace_id,
            },
        }), 200)

    logger.warning("login_failed", identifier=identifier)
    return make_response(jsonify({"error": "Invalid email or password"}), 400)


@auth_bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    user_id = get_jwt_identity()
    new_access_token = create_access_token(identity=user_id)
    return make_response(jsonify({"access_token": new_access_token}), 200)


@auth_bp.route("/profile", methods=["GET"])
@jwt_required()
def user_profile():
    user_id = get_jwt_identity()
    user = db.session.get(User, user_id)

    if user:
        return make_response(jsonify({"username": user.username, "email": user.email}), 200)
    return make_response(jsonify({"error": "User doesn't exist"}), 404)


@auth_bp.route("/logout", methods=["DELETE"])
@jwt_required()
def logout():
    jti = get_jwt()["jti"]
    now = datetime.now(timezone.utc)

    if TokenBlocklist.query.filter_by(jti=jti).first():
        return make_response(jsonify({"error": "Token already blacklisted"}), 400)

    db.session.add(TokenBlocklist(jti=jti, created_at=now))
    db.session.commit()
    logger.info("user_logout", jti=jti)
    return make_response(jsonify({"success": "Logged out successfully"}), 200)


@auth_bp.route("/forgot-password", methods=["POST"])
@limiter.limit("3 per minute")
def forgot_password():
    data = request.get_json()
    email = data.get("email")

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"error": "User not found"}), 404

    raw_token = str(uuid.uuid4())
    user.reset_token = _hash_token(raw_token)
    user.token_expiry = datetime.now(timezone.utc) + timedelta(hours=1)
    db.session.commit()

    send_reset_email(user, raw_token)
    logger.info("password_reset_requested", user_id=user.id)
    return jsonify({"message": "Password reset link sent to your email"}), 200


@auth_bp.route("/reset-password/<token>", methods=["POST"])
def reset_password(token):
    data = request.get_json()
    new_password = data.get("new_password")

    user = User.query.filter_by(reset_token=_hash_token(token)).first()
    if not user or not user.token_expiry or user.token_expiry < datetime.now(timezone.utc):
        return jsonify({"error": "Invalid or expired token"}), 400

    user.password = generate_password_hash(new_password)
    user.reset_token = None
    user.token_expiry = None
    db.session.commit()
    logger.info("password_reset_complete", user_id=user.id)
    return jsonify({"success": "Password updated successfully"}), 200


def send_reset_email(user, token):
    frontend_url = current_app.config.get("FRONTEND_URL", "https://taskly-app-iota.vercel.app")
    reset_url = f"{frontend_url}/reset-password/{token}"
    from app import mail as app_mail
    msg = Message("Password Reset Request", recipients=[user.email])
    msg.body = (
        f"Click the following link to reset your password: {reset_url}\n"
        "This link expires in 1 hour.\n"
        "If you did not request this, please ignore this email."
    )
    app_mail.send(msg)
