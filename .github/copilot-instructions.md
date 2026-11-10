# pd2-tools Copilot Instructions

## Big picture
- Monorepo with two apps: **api/** (Node/Express + Postgres/Redis) and **web/** (Vite + React + Mantine). API serves data consumed by the web client at /api/v1.
- API startup: api/src/index.ts wires Redis + DB shutdown; api/src/server.ts builds the Express app and mounts routes at /api/${API_VERSION}.
- Background work is intentionally separate from the HTTP process: api/src/jobs.ts starts cron jobs (character scraper, online player tracker, leaderboard updater). Production runs multiple API instances, so avoid mixing jobs into the server entry.

## Data flow & storage
- Primary data lives in Postgres; schemas are auto-created in code on startup:
  - Character/leaderboard schema: api/src/database/postgres/index.ts
  - Economy schema: api/src/database/postgres/economy.ts
- Redis is optional and used as a read-through cache. If Redis is unavailable, calls fall back to DB (see api/src/utils/cache.ts).
- GET routes commonly use auto-caching with deterministic cache keys; the `skills` query param is URL-encoded JSON and normalized for cache keys (api/src/middleware/auto-cache.ts).

## API conventions
- Routes are grouped in api/src/routes and assembled in api/src/routes/index.ts.
- Query validation is explicit; `validateSeason` enforces positive integers and attaches `seasonNumber` to the request (api/src/middleware/validation.ts).
- Responses use `{ error: { message } }` on failures; not-found handled by middleware (api/src/middleware/error-handler.ts).

## Frontend conventions
- API calls are centralized in web/src/api with a shared fetch wrapper (web/src/api/client.ts) and endpoint constants (web/src/config/api.ts).
- React Query is the default data-fetching layer with a 5-minute staleTime (web/src/App.tsx).
- Mantine is the UI system; global theme and routing live in web/src/App.tsx.

## External integrations
- PD2 public API is polled by background jobs (api/src/jobs/*) and by character scraper logic with rate limiting and profanity filtering.
- Economy/leaderboard data depends on scheduled jobs; avoid changing cron timing without understanding load constraints in api/src/jobs/character-scraper.ts.

## Dev workflows
- API: npm run dev (ts-node), npm run build, npm start, npm run jobs, npm test.
- Web: npm run dev, npm run build, npm run preview.
- Both apps rely on .env files (see README.md and .env.example in each app).
