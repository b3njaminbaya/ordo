# Ordo — Web

The React front end for [Ordo](../../README.md), by Benjamin Baya.

## Stack

React 19 · Vite · React Router v7 · Tailwind CSS · Framer Motion · Formik + Yup · Chart.js · @hello-pangea/dnd · Socket.IO client · Vitest + Testing Library

## Run it

From the repository root:

```bash
pnpm install
cd apps/web
pnpm dev            # http://localhost:5173
```

The app talks to the API at `VITE_API_BASE_URL` (default `http://localhost:5000` in development). For a production build, set it explicitly, or serve the API from the same origin:

```bash
VITE_API_BASE_URL=https://api.example.com pnpm build
```

## Scripts

| Command        | What it does                     |
|----------------|----------------------------------|
| `pnpm dev`     | Start the dev server             |
| `pnpm build`   | Production build into `dist/`    |
| `pnpm test`    | Run the test suite once (Vitest) |
| `pnpm lint`    | Run ESLint                       |

## Structure

```
src/
├── api/          Axios instance (token refresh) and error helpers
├── components/   ui/ (design-system pieces), auth/, common/, workspace/ (app screens)
├── context/      Auth, theme, notifications and running-timer state
├── pages/        Landing page and legal pages
├── utils/        Date/time helpers
├── config.js     API base URL resolution
└── socket.js     Authenticated Socket.IO client
```

## Author

Benjamin Baya — [b3njaminbaya@gmail.com](mailto:b3njaminbaya@gmail.com)
