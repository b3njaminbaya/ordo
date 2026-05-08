import pytest
import os

os.environ.setdefault("JWT_SECRET_KEY", "testing-secret")
os.environ.setdefault("SECRET_KEY", "testing-secret")
os.environ.setdefault("FLASK_ENV", "testing")

from app import app as flask_app
from models import db as _db


@pytest.fixture(scope="session")
def app():
    flask_app.config.update(
        TESTING=True,
        SQLALCHEMY_DATABASE_URI="sqlite:///:memory:",
        JWT_SECRET_KEY="testing-secret",
        SECRET_KEY="testing-secret",
        MAIL_SUPPRESS_SEND=True,
        RATELIMIT_ENABLED=False,
        WTF_CSRF_ENABLED=False,
    )
    ctx = flask_app.app_context()
    ctx.push()
    _db.create_all()
    yield flask_app
    _db.drop_all()
    ctx.pop()


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture(autouse=True)
def clean_db(app):
    """Wipe all rows between tests so tests are fully isolated."""
    yield
    _db.session.rollback()
    for table in reversed(_db.metadata.sorted_tables):
        _db.session.execute(table.delete())
    _db.session.commit()


# ── Helpers ───────────────────────────────────────────────────────────────────

def register(client, username="alice", email="alice@test.com", password="pass1234"):
    return client.post("/register", json={"username": username, "email": email, "password": password})


def login(client, identifier="alice", password="pass1234"):
    return client.post("/login", json={"identifier": identifier, "password": password})


def auth_headers(client, username="alice", email="alice@test.com", password="pass1234"):
    """Register (if needed) + login, return Authorization header dict."""
    register(client, username=username, email=email, password=password)
    res = login(client, identifier=username, password=password)
    token = res.get_json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
