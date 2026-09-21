"""Development seed data.

WARNING: this DROPS every table. It refuses to run against production and requires
an explicit --yes so it can't be triggered by accident.

    python seed.py --yes
"""
import os
import sys
from datetime import timedelta
from uuid import uuid4

if os.getenv("FLASK_ENV") == "production":
    sys.exit("Refusing to seed: FLASK_ENV=production")
if "--yes" not in sys.argv:
    sys.exit("This will DROP ALL TABLES in the configured database. Re-run with --yes to confirm.")

from werkzeug.security import generate_password_hash  # noqa: E402

from app import app  # noqa: E402
from models import (  # noqa: E402
    db, Comment, Notification, Task, TaskAssignment, TaskList, User, Workspace, WorkspaceInvite,
)
from validation import utcnow_naive  # noqa: E402

DEMO_PASSWORD = "password123"

with app.app_context():
    print("Seeding:", app.config["SQLALCHEMY_DATABASE_URI"].split("@")[-1])
    db.drop_all()
    db.create_all()

    workspace1 = Workspace(id=str(uuid4()), name="Development Team")
    workspace2 = Workspace(id=str(uuid4()), name="Marketing Team")
    db.session.add_all([workspace1, workspace2])
    db.session.flush()

    pw = generate_password_hash(DEMO_PASSWORD)
    user1 = User(username="john_doe", email="john@example.com", password=pw, role="user", workspace_id=workspace1.id)
    user2 = User(username="jane_smith", email="jane@example.com", password=pw, role="user", workspace_id=workspace2.id)
    db.session.add_all([user1, user2])
    db.session.flush()
    workspace1.owner_id, workspace2.owner_id = user1.id, user2.id

    db.session.add_all([
        WorkspaceInvite(email="new_member@example.com", workspace_id=workspace1.id, invited_by=user1.id, token=uuid4().hex),
        WorkspaceInvite(email="guest@example.com", workspace_id=workspace2.id, invited_by=user2.id, token=uuid4().hex),
    ])

    tasklist1 = TaskList(name="Work Tasks", user_id=user1.id)
    tasklist2 = TaskList(name="Campaigns", user_id=user2.id)
    db.session.add_all([tasklist1, tasklist2])
    db.session.flush()

    now = utcnow_naive()
    task1 = Task(title="Finish report", description="Complete the annual report.",
                 due_date=now + timedelta(days=3), priority="high", status="todo", tasklist_id=tasklist1.id)
    task2 = Task(title="Plan launch", description="Draft the launch plan.",
                 due_date=now + timedelta(days=7), priority="low", status="in-progress", tasklist_id=tasklist2.id)
    db.session.add_all([task1, task2])
    db.session.flush()

    db.session.add_all([
        TaskAssignment(user_id=user1.id, task_id=task1.id),
        TaskAssignment(user_id=user2.id, task_id=task2.id),
        Comment(content="This task is urgent!", task_id=task1.id, user_id=user1.id),
        Notification(message="Task assigned to you.", user_id=user1.id, task_id=task1.id),
    ])
    db.session.commit()

    print(f"Database seeded. Log in as john_doe / jane_smith with password: {DEMO_PASSWORD}")
