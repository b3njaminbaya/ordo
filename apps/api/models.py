from flask_sqlalchemy import SQLAlchemy
from sqlalchemy_serializer import SerializerMixin
from sqlalchemy.dialects.postgresql import ENUM
from datetime import datetime, timezone
from uuid import uuid4

def _utcnow():
    return datetime.now(timezone.utc)

db = SQLAlchemy()

priority_enum = ENUM("low", "medium", "high", "urgent", name="priority_levels", create_type=True)
status_enum = ENUM("pending", "in-progress", "completed", "todo", name="task_status", create_type=True)

class User(db.Model, SerializerMixin):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), default="user")
    notifications_enabled = db.Column(db.Boolean, default=True) 
    workspace_id = db.Column(db.String(36), db.ForeignKey('workspaces.id', ondelete="SET NULL"), nullable=True) 
    #is_verified = db.Column(db.Boolean, default=False)
    #verification_token = db.Column(db.String(100), nullable=True)
    profile_picture = db.Column(db.Text, nullable=True)
    reset_token = db.Column(db.String(100), nullable=True)
    token_expiry = db.Column(db.DateTime, nullable=True)

    tasklists = db.relationship("TaskList", back_populates="user", cascade="all, delete-orphan")
    tasks_assigned = db.relationship("TaskAssignment", back_populates="user", cascade="all, delete-orphan")
    comments = db.relationship("Comment", back_populates="user", cascade="all, delete-orphan")
    invites_sent = db.relationship("WorkspaceInvite", back_populates="inviter", cascade="all, delete-orphan")
    notifications = db.relationship("Notification", backref="user", cascade="all, delete-orphan")
    
    serialize_rules = (
        "-password",
        "-tasks_assigned.user",
        "-tasklists",
        "-comments.user",
        "-notifications.user",
        "-workspace",
        "-reset_token",
        "-token_expiry",
    )


class Workspace(db.Model, SerializerMixin):
    __tablename__ = "workspaces"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid4()))
    name = db.Column(db.String(100), unique=True, nullable=False)
    users = db.relationship('User', backref='workspace', cascade="all, delete-orphan", lazy=True)

    serialize_rules = ("-users.workspace",)


class WorkspaceInvite(db.Model, SerializerMixin):
    __tablename__ = "workspace_invites"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(100), nullable=False) 
    workspace_id = db.Column(db.String(36), db.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    invited_by = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)  
    status = db.Column(db.String(20), default="pending")  
    token = db.Column(db.String(100), unique=True, nullable=False) 
    created_at = db.Column(db.DateTime, default=_utcnow)

    workspace = db.relationship("Workspace", backref="invites")
    inviter = db.relationship("User", back_populates="invites_sent")

    serialize_rules = ("-token", "-inviter.workspace")

class TaskList(db.Model, SerializerMixin):
    __tablename__ = "tasklists"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    is_template = db.Column(db.Boolean, default=False)

    tasks = db.relationship("Task", backref="tasklist", cascade="all, delete-orphan")
    user = db.relationship("User", back_populates="tasklists")

    serialize_rules = (
        "-user",
        "-tasks.tasklist"
    )


def preload_task_templates():
    template_names = ["To-Do", "Doing", "Testing", "Done"]
    
    for name in template_names:
        existing_template = TaskList.query.filter_by(name=name, is_template=True).first()
        if not existing_template:
            template = TaskList(name=name, is_template=True)
            db.session.add(template)
    
    db.session.commit()


class Task(db.Model, SerializerMixin):
    __tablename__ = "tasks"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)
    due_date = db.Column(db.DateTime, nullable=True)
    priority = db.Column(priority_enum, nullable=False, default="medium")
    status = db.Column(status_enum, nullable=False, default="todo") 
    created_at = db.Column(db.DateTime, default=_utcnow)
    updated_at = db.Column(db.DateTime, default=_utcnow, onupdate=_utcnow)

    tasklist_id = db.Column(db.Integer, db.ForeignKey("tasklists.id", ondelete="CASCADE"), nullable=False)
    parent_task_id = db.Column(db.Integer, db.ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True)

    assignments = db.relationship("TaskAssignment", back_populates="task", cascade="all, delete-orphan")
    comments = db.relationship("Comment", back_populates="task", cascade="all, delete-orphan")
    notifications = db.relationship("Notification", backref="task", cascade="all, delete-orphan")

    serialize_rules = (
        "-tasklist",
        "-assignments",
        "-comments.task",
        "-notifications.task",
    )


class TaskAssignment(db.Model, SerializerMixin):
    __tablename__ = "task_assignments"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    task_id = db.Column(db.Integer, db.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)

    user = db.relationship("User", back_populates="tasks_assigned")
    task = db.relationship("Task", back_populates="assignments")

    serialize_rules = ("-user", "-task")


class Comment(db.Model, SerializerMixin):
    __tablename__ = "comments"

    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    task_id = db.Column(db.Integer, db.ForeignKey("tasks.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)

    task = db.relationship("Task", back_populates="comments")
    user = db.relationship("User", back_populates="comments")

    serialize_rules = ("-task", "-user")


class Notification(db.Model, SerializerMixin):
    __tablename__ = "notifications"

    id = db.Column(db.Integer, primary_key=True)
    message = db.Column(db.Text, nullable=False)
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=_utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    task_id = db.Column(db.Integer, db.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=True)  

    serialize_rules = ("-user",)


class TokenBlocklist(db.Model):
    __tablename__ = "token_blocklists"

    id = db.Column(db.Integer, primary_key=True)
    jti = db.Column(db.String(36), nullable=False, index=True)
    created_at = db.Column(db.DateTime, nullable=False)
