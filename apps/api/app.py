import gevent.monkey
gevent.monkey.patch_all()

import os
import structlog
from dotenv import load_dotenv

load_dotenv()

# ── Sentry (must init before Flask app) ──────────────────────────────────────
_SENTRY_DSN = os.getenv("SENTRY_DSN")
if _SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.flask import FlaskIntegration
    sentry_sdk.init(
        dsn=_SENTRY_DSN,
        integrations=[FlaskIntegration()],
        traces_sample_rate=0.2,
        send_default_pii=False,
    )

# ── Structlog ─────────────────────────────────────────────────────────────────
_IS_PROD = os.getenv("FLASK_ENV") == "production"
structlog.configure(
    processors=[
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.JSONRenderer() if _IS_PROD else structlog.dev.ConsoleRenderer(),
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
)
logger = structlog.get_logger()

# ── Flask ─────────────────────────────────────────────────────────────────────
from flask import Flask, jsonify
from werkzeug.exceptions import HTTPException
from werkzeug.middleware.proxy_fix import ProxyFix
from flask_migrate import Migrate
from flask_socketio import SocketIO
from flask_jwt_extended import JWTManager
from datetime import timedelta, timezone
from models import db, TokenBlocklist, User
from flask_cors import CORS
from flask_mail import Mail
from extensions import limiter

_IS_TESTING = os.getenv("FLASK_ENV") == "testing"
_DEV_SECRET = "dev-secret-change-me"

app = Flask(__name__)
app.url_map.strict_slashes = False
app.config["MAX_CONTENT_LENGTH"] = 12 * 1024 * 1024  # largest attachment is 10 MB + form overhead

# Behind a reverse proxy (Render, nginx, …) the real client IP is in X-Forwarded-For.
# Without this every visitor shares the proxy's IP and therefore one rate-limit bucket.
_proxies = int(os.getenv("TRUSTED_PROXY_COUNT", "1" if _IS_PROD else "0") or 0)
if _proxies:
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=_proxies, x_proto=_proxies, x_host=_proxies)

_frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
ALLOWED_ORIGINS = [_frontend_url] if _IS_PROD else list({_frontend_url, "http://localhost:5173"})

CORS(
    app,
    supports_credentials=True,
    origins=ALLOWED_ORIGINS,
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.config["MAIL_SERVER"]         = os.getenv("MAIL_SERVER", "smtp.gmail.com")
app.config["MAIL_PORT"]           = int(os.getenv("MAIL_PORT") or 587)
app.config["MAIL_USE_TLS"]        = os.getenv("MAIL_USE_TLS", "true").lower() != "false"
app.config["MAIL_USERNAME"]       = os.getenv("MAIL_USERNAME")
app.config["MAIL_PASSWORD"]       = os.getenv("MAIL_PASSWORD")
app.config["MAIL_DEFAULT_SENDER"] = os.getenv("MAIL_DEFAULT_SENDER")
app.config["MAIL_SUPPRESS_SEND"]  = _IS_TESTING

mail = Mail(app)

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///ordo.db")
app.config["SQLALCHEMY_DATABASE_URI"]        = DATABASE_URL
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

_jwt_secret = os.getenv("JWT_SECRET_KEY") or _DEV_SECRET
if _jwt_secret == _DEV_SECRET:
    if _IS_PROD:
        # Anyone could mint valid tokens with the published default. Refuse to boot.
        raise RuntimeError("JWT_SECRET_KEY must be set to a strong random value in production")
    logger.warning("insecure_default_jwt_secret", hint="set JWT_SECRET_KEY before deploying")
app.config["JWT_SECRET_KEY"]          = _jwt_secret
app.config["SECRET_KEY"]              = os.getenv("SECRET_KEY") or _jwt_secret
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(days=7)
# Same default as the CORS origin so emailed links always match where the app is served.
app.config["FRONTEND_URL"]            = _frontend_url

db.init_app(app)
migrate = Migrate(app, db)

# ── Rate limiter ──────────────────────────────────────────────────────────────
REDIS_URL = os.getenv("REDIS_URL")
# Flask-Limiter reads its config inside init_app, so these must be set first.
app.config["RATELIMIT_STORAGE_URI"] = REDIS_URL or "memory://"
app.config["RATELIMIT_ENABLED"] = not _IS_TESTING
limiter.init_app(app)

# ── Socket.IO (Redis message queue when REDIS_URL is set) ────────────────────
socketio = SocketIO(
    app,
    cors_allowed_origins=ALLOWED_ORIGINS,
    async_mode="gevent",
    message_queue=REDIS_URL,
    logger=False,
    engineio_logger=False,
)

jwt = JWTManager(app)

from views import (
    user_bp, auth_bp, tasklist_bp, task_bp,
    task_assignment_bp, comments_bp, notifications_bp, task_stats_bp,
    subtasks_bp, attachments_bp, recurring_bp, time_entries_bp,
)
import views.realtime  # noqa: F401  (registers Socket.IO event handlers)

app.register_blueprint(user_bp)
app.register_blueprint(auth_bp)
app.register_blueprint(tasklist_bp)
app.register_blueprint(task_bp)
app.register_blueprint(task_assignment_bp)
app.register_blueprint(comments_bp)
app.register_blueprint(notifications_bp)
app.register_blueprint(task_stats_bp)
app.register_blueprint(subtasks_bp)
app.register_blueprint(attachments_bp)
app.register_blueprint(recurring_bp)
app.register_blueprint(time_entries_bp)


@jwt.token_in_blocklist_loader
def check_if_token_revoked(jwt_header, jwt_payload: dict) -> bool:
    """A token is dead if it was logged out, its user is gone, or the user's
    password changed after it was issued."""
    if db.session.query(TokenBlocklist.id).filter_by(jti=jwt_payload["jti"]).first() is not None:
        return True
    try:
        user = db.session.get(User, int(jwt_payload["sub"]))
    except (TypeError, ValueError):
        return True
    if user is None:
        return True
    if user.password_changed_at is not None:
        changed = int(user.password_changed_at.replace(tzinfo=timezone.utc).timestamp())
        if int(jwt_payload.get("iat", 0)) < changed:
            return True
    return False


# ── JSON error responses (the API never returns HTML) ────────────────────────
@app.errorhandler(HTTPException)
def handle_http_error(err):
    if err.code == 429:
        message = "Too many requests. Please wait a moment and try again."
    elif err.code == 413:
        message = "The uploaded file is too large."
    else:
        message = err.description or err.name
    return jsonify({"error": message}), err.code


@app.errorhandler(Exception)
def handle_unexpected_error(err):
    db.session.rollback()
    logger.exception("unhandled_exception", error=str(err))
    return jsonify({"error": "Something went wrong on our side. Please try again."}), 500


@app.route("/")
def index():
    return jsonify({"message": "Welcome to Ordo API"})


# ── APScheduler: deadline notifications ──────────────────────────────────────
def _start_scheduler():
    from apscheduler.schedulers.background import BackgroundScheduler
    from views.notifications import check_task_deadlines
    from views.recurring import spawn_recurring_tasks

    check_interval_hours = int(os.getenv("DEADLINE_CHECK_INTERVAL_HOURS", 1))

    def _run_deadline():
        with app.app_context():
            check_task_deadlines()

    def _run_recurring():
        with app.app_context():
            spawn_recurring_tasks()

    scheduler = BackgroundScheduler()
    scheduler.add_job(
        _run_deadline,
        trigger="interval",
        hours=check_interval_hours,
        id="deadline_check",
        replace_existing=True,
    )
    scheduler.add_job(
        _run_recurring,
        trigger="interval",
        hours=1,
        id="recurring_spawn",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("scheduler_started", jobs=["deadline_check", "recurring_spawn"])
    return scheduler


# Start the scheduler at import time, except under tests or when disabled
# (set RUN_SCHEDULER=0 on all but one instance when running several).
# Both jobs are safe to run concurrently: reminders are claimed through a unique
# row and recurring tasks through a compare-and-set on next_run_at.
if not _IS_TESTING and os.getenv("RUN_SCHEDULER", "1") != "0" and not os.environ.get("WERKZEUG_RUN_MAIN"):
    _start_scheduler()


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    socketio.run(
        app,
        host="0.0.0.0",
        port=port,
        debug=os.getenv("FLASK_DEBUG") == "1" and not _IS_PROD,
        use_reloader=False,
    )
