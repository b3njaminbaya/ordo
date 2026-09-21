# Ordo

A full-stack project management app — tasks, Kanban, calendar, time tracking and real-time team collaboration — designed and built by **Benjamin Baya**.

This is a personal portfolio project. It shows how I design, build, secure and test a multi-user web application end to end: a React front end, a Flask API with WebSockets, a PostgreSQL schema with migrations, and CI.

**Author:** Benjamin Baya · [b3njaminbaya@gmail.com](mailto:b3njaminbaya@gmail.com) · [GitHub @b3njaminbaya](https://github.com/b3njaminbaya)

---

## Live demo

The demo runs on free-tier hosting, so please keep these in mind:

- **The first request can take up to a minute** while the server wakes up after a quiet period.
- **Data can be reset or deleted at any time**, and the demo may occasionally be offline. It is not a service — use fake data and don't store anything you care about.
- There are no plans, limits or fees.

Prefer to run it yourself? See [Development setup](#development-setup).

---

## What it demonstrates

- **Multi-tenant access control** — every endpoint is scoped to the caller's workspace; cross-workspace access is covered by tests.
- **Authentication done carefully** — hashed passwords, signed tokens revoked on logout and password change, hashed single-use reset links, rate limiting, authenticated WebSockets.
- **Real-time collaboration** — Socket.IO rooms chosen by the server from the caller's identity, with optimistic UI and rollback on the client.
- **Correctness details** — timezone-safe time tracking, concurrency-safe background jobs, database constraints backing application rules, safe file handling.
- **Testing** — a 150+ test API suite and a component/regression suite for the web app.

## Features

- **Task management** — task lists, subtasks, priorities, due dates, assignees, comments, file attachments, recurring tasks
- **Kanban boards** — drag-and-drop columns with live updates
- **Calendar view** — monthly overview of all deadlines
- **Time tracking** — live timers per task (kept in sync across your own devices), manual entries, weekly totals, CSV export
- **Analytics** — status breakdown, weekly velocity, workload per person
- **Team collaboration** — workspaces with an owner, email/link invites (expiring and revocable), member removal, real-time sync between teammates
- **Notifications** — assignment and comment alerts, plus deadline reminders (24 h, 1 h, overdue)

---

## Tech stack

| Layer     | Technology |
|-----------|-----------|
| Frontend  | React 19, Vite, React Router v7, Tailwind CSS, Framer Motion, Socket.IO client |
| Backend   | Python 3.12, Flask, Flask-SQLAlchemy, Flask-Migrate, Flask-SocketIO (gevent), Flask-JWT-Extended, Flask-Mail |
| Database  | PostgreSQL |
| Monorepo  | pnpm workspaces + Turborepo |
| CI/CD     | GitHub Actions → Vercel (web) + Render (API) |

---

## Project structure

```
ordo/
├── apps/
│   ├── web/          # React + Vite frontend (@ordo/web)
│   └── api/          # Flask API
│       ├── views/    # Route blueprints (auth, user, tasks, time_entries, …)
│       ├── models.py # SQLAlchemy models
│       └── app.py    # App setup + SocketIO init
├── packages/
│   ├── ui/           # Shared Tailwind preset + design tokens (@ordo/ui)
│   ├── types/        # Shared TypeScript types (@ordo/types)
│   └── config/       # Shared ESLint + tsconfig presets
└── package.json      # pnpm workspace root
```

---

## Development setup

### Prerequisites

- Node.js 22+, pnpm 11+
- Python 3.12
- PostgreSQL (local or remote)

### 1. Install JS dependencies

```bash
pnpm install
```

### 2. Set up the API

```bash
cd apps/api
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create `apps/api/.env` (see `.env.example`):

```env
DATABASE_URL=postgresql://user:password@localhost:5432/ordo
JWT_SECRET_KEY=your-secret-key
SECRET_KEY=your-flask-secret
FRONTEND_URL=http://localhost:5173

# Email (optional for local dev)
MAIL_SERVER=smtp.example.com
MAIL_PORT=587
MAIL_USE_TLS=true
MAIL_USERNAME=your@email.com
MAIL_PASSWORD=yourpassword
MAIL_DEFAULT_SENDER=your@email.com
```

Run migrations and start the API:

```bash
flask db upgrade
python app.py
```

API runs at `http://localhost:5000`.

Run the API tests (they use an in-memory SQLite database and never touch `DATABASE_URL`):

```bash
pip install -r requirements-dev.txt
python -m pytest tests/
```

Optional dev data (drops all tables — refuses to run when `FLASK_ENV=production`):

```bash
python seed.py --yes     # demo users john_doe / jane_smith, password: password123
```

### 3. Start the frontend

```bash
cd apps/web
# Optional: create apps/web/.env.local
# VITE_API_BASE_URL=http://localhost:5000
pnpm dev
```

Frontend runs at `http://localhost:5173`. Run its tests with `pnpm test`.

---

## Deployment

GitHub Actions can deploy on push to `main`:

- **Frontend** → Vercel (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` secrets)
- **API** → Render (`render.yaml` drives the service; `RENDER_DEPLOY_HOOK_URL` secret triggers a manual redeploy)

Required environment variables: `DATABASE_URL`, `JWT_SECRET_KEY`, `FRONTEND_URL`, and optional `MAIL_*`, `SENTRY_DSN`, `REDIS_URL`.

Things to know before deploying:

- **`JWT_SECRET_KEY` is mandatory in production.** With `FLASK_ENV=production` the API refuses to start without it.
- **Set `VITE_API_BASE_URL` when building the frontend** (or serve the API from the same origin). The app does not fall back to any hosted demo API on other domains.
- **Uploads live on local disk** (`apps/api/uploads/`). Mount a persistent volume there, or files are lost when the container is replaced. Back it up with the database.
- **Behind a reverse proxy**, set `TRUSTED_PROXY_COUNT` (defaults to `1` in production) so rate limits apply per client rather than per proxy.
- **Several API instances:** set `REDIS_URL` (rate limits + Socket.IO fan-out) and `RUN_SCHEDULER=0` on all but one instance. The reminder and recurring-task jobs are safe if two run at once, but that wastes work.
- **PostgreSQL is required for anything real.** SQLite is for local development and tests only; it does not enforce the status/priority enums.

---

## License

[MIT](LICENSE) © 2026 Benjamin Baya. You're welcome to read, run, fork and learn from this code.

---

## Contact

Feedback, bug reports and questions are welcome: [b3njaminbaya@gmail.com](mailto:b3njaminbaya@gmail.com)
