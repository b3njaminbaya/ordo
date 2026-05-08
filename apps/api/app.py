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
from flask_migrate import Migrate
from flask_socketio import SocketIO
from flask_jwt_extended import JWTManager
from datetime import timedelta
from models import db, TokenBlocklist
from flask_cors import CORS
from flask_mail import Mail
from extensions import limiter

app = Flask(__name__)
app.url_map.strict_slashes = False

ALLOWED_ORIGINS = [
    "https://taskly-app-iota.vercel.app",
    "http://localhost:5173",
]

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
app.config["MAIL_SUPPRESS_SEND"]  = os.getenv("FLASK_ENV") == "testing"

mail = Mail(app)

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///taskly.db")
app.config["SQLALCHEMY_DATABASE_URI"]        = DATABASE_URL
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

app.config["JWT_SECRET_KEY"]          = os.getenv("JWT_SECRET_KEY", "dev-secret-change-me")
app.config["SECRET_KEY"]              = os.getenv("SECRET_KEY", "dev-secret-change-me")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(days=7)
app.config["FRONTEND_URL"]            = os.getenv("FRONTEND_URL", "https://taskly-app-iota.vercel.app")

db.init_app(app)
migrate = Migrate(app, db)

# ── Rate limiter ──────────────────────────────────────────────────────────────
REDIS_URL = os.getenv("REDIS_URL")
limiter.init_app(app)
app.config["RATELIMIT_STORAGE_URI"] = REDIS_URL or "memory://"
app.config["RATELIMIT_ENABLED"] = not app.config.get("TESTING", False)

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
    subtasks_bp,
)
import views.realtime  # registers Socket.IO event handlers

app.register_blueprint(user_bp)
app.register_blueprint(auth_bp)
app.register_blueprint(tasklist_bp)
app.register_blueprint(task_bp)
app.register_blueprint(task_assignment_bp)
app.register_blueprint(comments_bp)
app.register_blueprint(notifications_bp)
app.register_blueprint(task_stats_bp)
app.register_blueprint(subtasks_bp)


@jwt.token_in_blocklist_loader
def check_if_token_revoked(jwt_header, jwt_payload: dict) -> bool:
    jti = jwt_payload["jti"]
    return db.session.query(TokenBlocklist.id).filter_by(jti=jti).scalar() is not None


@app.route("/")
def index():
    return jsonify({"message": "Welcome to Taskly API"})


# ── APScheduler: deadline notifications ──────────────────────────────────────
def _start_scheduler():
    from apscheduler.schedulers.background import BackgroundScheduler
    from views.notifications import check_task_deadlines

    def _run():
        with app.app_context():
            check_task_deadlines()
            logger.info("deadline_check_complete")

    scheduler = BackgroundScheduler()
    scheduler.add_job(_run, trigger="interval", hours=1, id="deadline_check", replace_existing=True)
    scheduler.start()
    logger.info("scheduler_started", job="deadline_check", interval_hours=1)
    return scheduler


if __name__ == "__main__":
    _start_scheduler()
    port = int(os.getenv("PORT", 5000))
    socketio.run(
        app,
        host="0.0.0.0",
        port=port,
        debug=not _IS_PROD,
        use_reloader=False,
    )
