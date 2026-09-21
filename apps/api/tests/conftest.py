import os

# The database engine is bound when the app module is imported, so these MUST be
# forced (not setdefault) before the import below. Otherwise a developer's .env
# DATABASE_URL would be used and the clean_db fixture would wipe that database.
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["JWT_SECRET_KEY"] = "testing-secret-testing-secret-32b"
os.environ["SECRET_KEY"] = "testing-secret-testing-secret-32b"
os.environ["FLASK_ENV"] = "testing"
os.environ.pop("REDIS_URL", None)
os.environ.pop("SENTRY_DSN", None)

import pytest  # noqa: E402

from app import app as flask_app  # noqa: E402
from models import db as _db  # noqa: E402


@pytest.fixture(scope="session")
def app():
    assert flask_app.config["SQLALCHEMY_DATABASE_URI"] == "sqlite:///:memory:", (
        "Refusing to run tests against a non-test database"
    )
    flask_app.config.update(TESTING=True, MAIL_SUPPRESS_SEND=True)
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
    # Rows were deleted behind the ORM's back and SQLite reuses ids, so drop every
    # cached instance or the next test can collide with a stale one.
    _db.session.expunge_all()


# ── Helpers ───────────────────────────────────────────────────────────────────

def register(client, username="alice", email="alice@test.com", password="pass1234"):
    return client.post("/register", json={"username": username, "email": email, "password": password})


def login(client, identifier="alice", password="pass1234"):
    return client.post("/login", json={"identifier": identifier, "password": password})


def auth_headers(client, username="alice", email=None, password="pass1234"):
    """Register (if needed) + login, return Authorization header dict."""
    email = email or f"{username}@test.com"
    reg = register(client, username=username, email=email, password=password)
    res = login(client, identifier=username, password=password)
    assert res.status_code == 200, f"login failed: register={reg.status_code} {reg.get_json()} login={res.get_json()}"
    token = res.get_json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
