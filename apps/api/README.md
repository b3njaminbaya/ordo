# Ordo — API

The Flask backend for [Ordo](../../README.md), by Benjamin Baya. It provides authentication, workspaces and invites, tasks and lists, comments, attachments, notifications, recurring tasks, time tracking, analytics, and real-time updates over Socket.IO.

## Stack

Python 3.12 · Flask · Flask-SQLAlchemy · Flask-Migrate (Alembic) · Flask-SocketIO (gevent) · Flask-JWT-Extended · Flask-Limiter · Flask-Mail · APScheduler · PostgreSQL

## Layout

```
app.py                    App setup, CORS, JWT, limiter, error handlers, scheduler
models.py                 SQLAlchemy models
access.py                 Workspace (tenant) access helpers used by every view
validation.py             Input validation helpers
serializers.py            JSON shapes shared by REST and Socket.IO
workspace_service.py      Leaving / removing members without losing team data
notifications_service.py  Sending notifications and the deadline job
files.py                  Upload helpers (image sniffing, safe deletion)
views/                    One blueprint per feature
migrations/               Alembic migrations
tests/                    pytest suite (in-memory SQLite)
```

## Run it

```bash
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # then edit
flask db upgrade
python app.py               # http://localhost:5000
```

## Test it

```bash
pip install -r requirements-dev.txt
python -m pytest tests/
```

The tests force an in-memory SQLite database, so they never touch the database in your `.env`.

## Notes

- Set `JWT_SECRET_KEY` in production; the app refuses to start without it when `FLASK_ENV=production`.
- Uploads are stored on local disk in `uploads/` — mount a persistent volume in production.
- See the [root README](../../README.md) for deployment notes and environment variables.

## Author

Benjamin Baya — [b3njaminbaya@gmail.com](mailto:b3njaminbaya@gmail.com)
