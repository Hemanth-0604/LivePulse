# LivePulse

Real-time polling app. Create a poll, share a link, watch votes update live — no page refresh.

```
/Backend
  /config       > Mongo + Redis connection setup
  /controllers  > auth, poll, and WebSocket handlers
  /middleware   > JWT auth middleware
  /models       > Poll, User
  /routes       > route registration
  /services     > auth (JWT/bcrypt) and Redis pub/sub helpers
  main.go

/Frontend
  /public
  /src
    /components > Header, ThemeToggle
    /lib        > api, auth, socket, theme, voter, recentEmails
    /pages      > AuthPage, CreatePollPage, JoinPage, PollPage
    /styles     > livepulse.css
    App.jsx, main.jsx

docker-compose.yml  > local Mongo + Redis for development
```

## Stack

- **Frontend:** React, React Router, Vite
- **Backend:** Go, Gin
- **Database:** MongoDB (polls, users)
- **Realtime:** Redis pub/sub → WebSocket fan-out
- **Auth:** JWT (bcrypt-hashed passwords) + optional "Sign in with Google"

## Running it locally

### Option A — Docker for Mongo/Redis, run the apps yourself

```bash
docker-compose up -d
```

This brings up local MongoDB and Redis so you don't need them installed natively. Check `docker-compose.yml` for the exact ports/credentials it exposes and make sure your `.env` files match them.

### Backend

```bash
cd Backend
cp .env.example .env   # fill in your own values, see below
go run main.go
```

### Frontend

```bash
cd Frontend
cp .env.example .env   # if present; otherwise edit .env directly
npm install
npm run dev
```

Opens on `http://localhost:5173` by default, talking to the backend at whatever `VITE_API_URL` is set to.

## Environment variables

**Backend (`Backend/.env`)**

| Var | Purpose |
|---|---|
| `MONGO_URI` | MongoDB connection string |
| `MONGO_DB_NAME` | Database name |
| `REDIS_ADDR` | Redis host:port |
| `REDIS_PASSWORD` | Redis auth password (blank if none) |
| `REDIS_TLS` | `true` if your Redis provider requires TLS (e.g. Upstash) |
| `JWT_SECRET` | Long random string — signs auth tokens |
| `PORT` | Port the Go server listens on |
| `ALLOWED_ORIGINS` | Comma-separated list of frontend origins allowed to call this API (CORS). Must exactly match your deployed frontend URL(s), including `https://` and no trailing slash |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID, if using "Sign in with Google" |

**Frontend (`Frontend/.env`)**

| Var | Purpose |
|---|---|
| `VITE_API_URL` | Base URL of the backend API |
| `VITE_GOOGLE_CLIENT_ID` | Same Google client ID as the backend. Leave blank to hide the Google sign-in button and use email/password only |

## Deployment

- **Frontend:** Vercel. Use the stable production domain (Vercel Project → Settings → Domains) for anything you share publicly or put in `ALLOWED_ORIGINS` — branch/preview URLs change on every deploy and will get CORS-blocked unless added individually.
- **Backend:** Render (or similar). Env vars are set in the host's dashboard, not committed to git. Changing an env var requires a redeploy to take effect — it doesn't hot-reload a running instance.
- **Database:** MongoDB Atlas.
- **Redis:** Upstash (or similar managed Redis with TLS support).

## Key decisions

- **Poll expiry is enforced server-side**, not just in the UI. The Go backend checks `closesAt` against the current time on every vote and on poll fetch, so a bypassed frontend timer can't extend voting past the real deadline.
- **Realtime uses Redis pub/sub, not client-side polling.** A vote handled by any backend instance publishes to a `poll:{code}:stream` channel; every instance's WebSocket hub subscribes and fans out to its own connected clients. This is what lets the backend scale to multiple instances without clients missing updates.
- **Duplicate-vote protection uses a Redis `SETNX` fingerprint claim** (IP + user-agent hash, TTL'd to the poll's close time) rather than trusting anything from the client.
- **Google sign-in verifies the ID token server-side** via Google's `tokeninfo` endpoint (checking audience + `email_verified`) rather than trusting whatever the frontend claims — and links to an existing email/password account by email if one already exists, rather than creating a duplicate.
- **CORS is origin-allowlist based** (`ALLOWED_ORIGINS`), not wildcarded — deliberate tradeoff of a bit of deploy-config friction (see the note above about preview URLs) for not leaving the API open to arbitrary origins.