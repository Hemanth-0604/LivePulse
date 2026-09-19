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

## Tech stack coverage (required layers)

| Layer | Use | Where it lives |
|---|---|---|
| Frontend | React | `Frontend/src` |
| Backend | Go (Gin) | `Backend` |
| Database | MongoDB | `Backend/config/db.go`, `Backend/models` |
| Realtime | Redis | `Backend/config/redis.go`, `Backend/services/redis_service.go` |

**Frontend — React**
- `App.jsx` — routes for `/` (Join), `/login` (Auth), `/create` (Create Poll), `/p/:code` (Poll/Results), via React Router
- `pages/JoinPage.jsx`, `AuthPage.jsx`, `CreatePollPage.jsx`, `PollPage.jsx` — the four screens. `CreatePollPage.jsx` includes a custom poll-duration picker (preset minute buttons plus a free-entry custom option, capped to match the backend's validated range). `PollPage.jsx` lets a voter change their pick any time while the poll is live — clicking a different option re-submits and moves the "your vote" marker, rather than locking after the first click.
- `lib/api.js` — fetch wrapper calling the Go backend (`login`, `signup`, `googleLogin`, `createPoll`, etc.)
- `lib/auth.js` — stores/reads the JWT in `localStorage`
- `lib/socket.js` — opens the WebSocket connection to `/ws/polls/:code`
- `lib/theme.js` — reads/writes the light/dark preference, applied via a `data-theme` attribute on `<html>` and persisted to `localStorage`, initialized from system preference on first visit
- `styles/livepulse.css` — all theme colors are declared once as CSS variables in `:root` / `:root[data-theme="light"]`, so every page and component reads the same source of truth instead of each page redeclaring its own palette
- `components/Header.jsx`, `ThemeToggle.jsx`, `lib/voter.js`, `lib/recentEmails.js` — present in the project; contents not yet documented in detail here

**Backend — Go (Gin)**
- `main.go` — entrypoint, starts the Gin server
- `routes/routes.go` — registers every endpoint, sets up CORS via `ALLOWED_ORIGINS`
- `controllers/auth_controller.go` — `Signup`, `Login`, `GoogleLogin` handlers
- `controllers/poll_controller.go` — `CreatePoll`, `GetPoll`, `Vote`. Duration is validated server-side (bounded, not just whatever the frontend's preset buttons send), and `Vote` handles both a first-time vote and a voter switching their pick — both go through the same atomic path (see Realtime — Redis below). Expiry (`closesAt`) is checked independently on every vote and every poll fetch, regardless of what the frontend's countdown displays.
- `controllers/ws_controller.go` — WebSocket upgrade handler and hub
- `middleware/auth.go` — `JWTAuth()`, guards poll creation
- `services/auth_service.go` — `HashPassword`/`CheckPassword` (bcrypt), `GenerateJWT`

**Database — MongoDB**
- `config/db.go` — Mongo client/connection setup
- `models/poll.go` — Poll schema: question, options, `durationSec`, `closesAt`, share code, creator ID
- `models/user.go` — User schema: email, `password_hash`, `google_id`, `created_at`
- Both collections are read/written directly through the controllers above — `Signup` inserts into `users`; `CreatePoll` inserts into the polls collection; `Vote`/`GetPoll` read from it

**Realtime — Redis**
- `config/redis.go` — Redis client setup
- `services/redis_service.go`:
  - `HIncrBy` atomically increments the actual per-option vote count — this *is* the count, not a display-only mirror of a Mongo value
  - Publishes to a `poll:{code}:stream` channel on every vote that actually changes the tally
  - Duplicate/duplicate-switch voting is handled by a single atomic Redis Lua script (`EVAL`), keyed on a fingerprint (IP + user-agent hash, TTL'd to the poll's close time). A first vote claims the fingerprint and increments its pick; clicking the same option again is a no-op; picking a different option atomically decrements the old pick and increments the new one in one indivisible operation — so a voter can change their mind, but never ends up counted for two options, and two near-simultaneous switch requests from the same voter can't interleave and desync the tally
- `ws_controller.go` — each backend instance subscribes to that channel and fans results out over WebSocket to connected browsers

Redis is load-bearing here, not decorative: disconnect it and live results stop updating — there is no polling fallback that fakes the realtime behavior.

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

- **Poll expiry is enforced server-side**, not just in the UI. The Go backend checks `closesAt` against the current time on every vote and on poll fetch, so a bypassed frontend timer can't extend voting past the real deadline. The same applies to custom poll durations — the value is validated and bounded server-side, not trusted as-is from whatever the frontend's duration picker sends.
- **Realtime uses Redis pub/sub, not client-side polling.** A vote handled by any backend instance publishes to a `poll:{code}:stream` channel; every instance's WebSocket hub subscribes and fans out to its own connected clients. This is what lets the backend scale to multiple instances without clients missing updates.
- **Voting supports changing your pick, not just a one-shot vote — but it's still strictly one counted vote per person.** A voter is identified by a Redis-stored fingerprint (IP + user-agent hash, TTL'd to the poll's close time). Switching an existing vote to a different option runs as a single atomic Redis Lua script rather than three separate calls (read the old pick, decrement it, increment the new one, store the new pick) — doing it as separate calls would leave a window where two near-simultaneous switches from the same voter could race and desync the tally from what's actually stored as their current pick.
- **Google sign-in verifies the ID token server-side** via Google's `tokeninfo` endpoint (checking audience + `email_verified`) rather than trusting whatever the frontend claims — and links to an existing email/password account by email if one already exists, rather than creating a duplicate.
- **CORS is origin-allowlist based** (`ALLOWED_ORIGINS`), not wildcarded — deliberate tradeoff of a bit of deploy-config friction (see the note above about preview URLs) for not leaving the API open to arbitrary origins.
- **Theme is a single source of truth, not per-page CSS.** All color values are CSS variables declared once (`:root` / `:root[data-theme="light"]`), read by every page and component — avoids the class of bug where one page's palette silently diverges from another's after an edit.

## Not yet shipped

- Email verification on signup (planned: unverified account created at signup, verification link emailed via SMTP, login blocked until verified).

## AI tools used

*(Fill this in honestly for your submission video and this section — which
tools you used, and specifically how they helped or got in the way. Being
specific is part of what's being evaluated, not just naming a tool.)*