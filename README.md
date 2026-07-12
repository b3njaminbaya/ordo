# Teevexa Ordo

Self-hosted project management software. Buy once, deploy on your own server, own your data forever — no monthly per-seat fees.

---

## What it is

Teevexa Ordo is a full-featured project management tool sold as a one-time source-code license. Companies try the hosted demo, purchase the license, and run it entirely on their own infrastructure. Their data never touches our servers after deployment.

---

## Features

- **Task management** — task lists, subtasks, priorities, due dates, status labels
- **Kanban boards** — drag-and-drop columns with live updates
- **Calendar view** — monthly overview of all deadlines
- **Time tracking** — live timers per task, synced across the team via Socket.IO
- **Velocity analytics** — completion rate charts, week-over-week trends
- **Team collaboration** — workspaces, member invites, real-time Socket.IO sync
- **Smart notifications** — deadline reminders and task-update alerts
- **Secure by default** — bcrypt passwords, signed JWTs blocklisted on logout, SHA-256 reset tokens

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
teevexa-ordo/
├── apps/
│   ├── web/          # React + Vite frontend (@teevexa-ordo/web)
│   └── api/          # Flask API
│       ├── views/    # Route blueprints (auth, user, tasks, time_entries, …)
│       ├── models.py # SQLAlchemy models
│       └── app.py    # App factory + SocketIO init
├── packages/
│   ├── ui/           # Shared Tailwind preset + design tokens (@teevexa-ordo/ui)
│   ├── types/        # Shared TypeScript types (@teevexa-ordo/types)
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

Create `apps/api/.env`:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/teevexa_ordo
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

### 3. Start the frontend

```bash
cd apps/web
# Optional: create apps/web/.env.local
# VITE_API_BASE_URL=http://localhost:5000
pnpm dev
```

Frontend runs at `http://localhost:5173`.

---

## Deployment

The demo instance auto-deploys via GitHub Actions on push to `main`:

- **Frontend** → Vercel (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` secrets)
- **API** → Render (`render.yaml` drives the service; `RENDER_DEPLOY_HOOK_URL` secret triggers a manual redeploy)

Required Render environment variables: `DATABASE_URL`, `JWT_SECRET_KEY`, `SECRET_KEY`, `FRONTEND_URL`, and optional `MAIL_*` and `SENTRY_DSN`.

For client self-hosted deployments, a Docker setup and step-by-step deployment guide are provided separately with the license.

---

## Licensing

Teevexa Ordo is sold as a **one-time source-code license**. The hosted version at this repository is a public demo — companies can sign up and evaluate all features before purchasing.

Upon purchase you receive:
- Full source code
- 60 days of bug-fix support and deployment assistance
- Optional paid maintenance plan for continued updates after that

To enquire about licensing: **sales@teevexa.com**

---

## Support

- General / technical: support@teevexa.com
- Licensing / sales: sales@teevexa.com
- Follow us: [LinkedIn](https://linkedin.com/company/teevexa) · [X](https://x.com/teevexa_) · [Instagram](https://instagram.com/teevexa)
