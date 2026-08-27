# WitnessMark — Backend

Node.js/TypeScript (Express) backend for [WitnessMark](../README.md),
live at **https://witnessmark-api.fly.dev**, deployed 24/7 on Fly.io.

The backend is a **read-cache and off-chain aux service**, never a
financial authority — it holds no private key and cannot move funds.
Every contract write is signed client-side by the user's own wallet
directly against GenLayer. See `docs/architecture.md` at the repo root
for the full source-of-truth split.

## Run locally

```bash
npm install
cp .env.example .env   # then fill in real values, see below
npm run migrate         # applies src/db/schema.sql
npm run dev
```

Requires a reachable Postgres and Redis instance (see `DATABASE_URL` /
`REDIS_URL`) — for quick local iteration without either, `npm run test`
runs the full test suite against mocked DB/Redis/GenLayer modules and
needs neither.

## Environment variables (`.env`)

See `.env.example` for the full list with inline comments. Never commit
`.env` — it's gitignored. Summary:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string (Fly Postgres in production) |
| `GENLAYER_CONTRACT_ADDRESS` | Deployed WitnessMark contract address |
| `GENLAYER_NETWORK` | `studionet` |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` | Evidence file storage |
| `REDIS_URL` | Upstash Redis — caches GenLayer reads to stay under StudioNet's 30 req/min limit |
| `SESSION_JWT_SECRET` | Wallet-auth session signing secret |
| `REOWN_PROJECT_ID` | Not currently used server-side, kept for parity with frontend config |
| `PORT`, `NODE_ENV`, `CORS_ORIGIN` | Server config |

## Scripts

```bash
npm run dev         # tsx watch
npm run build        # tsc
npm run typecheck    # tsc --noEmit
npm run test          # vitest — 24 tests, mocked DB/Redis/GenLayer
npm run migrate       # applies src/db/schema.sql
npm start             # node dist/index.js (production)
```

## Structure

- `src/app.ts` — the Express app (routes, middleware). Separate from
  `src/index.ts` (just `.listen()` + process signal handling)
  specifically so `tests/*.test.ts` can drive it with `supertest`
  without binding a real port.
- `src/lib/genlayer.ts` — read-only `genlayer-js` client wrapper; every
  method name copied verbatim from `contracts/witnessmark_contract.py`.
- `src/lib/redis.ts` — the `cached()` helper every GenLayer-reading route
  uses, tuned per-endpoint to stay under StudioNet's 30 req/min limit.
- `src/lib/auth.ts` — wallet-auth (nonce/challenge/signature/session).
- `src/routes/evidence.ts` — file upload (Cloudinary), authorization-
  checked against a live on-chain read of the promise's counterparty.
- `src/routes/promises.ts` — off-chain index sync (`/sync` derives all
  stored values from a live chain read, never from client-supplied body
  fields — see the route's own comment for why that matters).
- `src/db/schema.sql` — Postgres schema; `pool.ts` / `migrate.ts` are the
  thin wrappers around it.

## Deployment

Fly.io app `witnessmark-api`, region `iad`. `fly.toml` sets
`min_machines_running = 1` and `auto_stop_machines = false` so it never
scales to zero — required for the 24/7 uptime this service needs. See
`docs/deployment.md` at the repo root for the full redeploy/secrets
workflow.
