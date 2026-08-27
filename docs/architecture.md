# WitnessMark — System Architecture

## Flow

```
User (wallet)
   |
   v
Frontend (Next.js, Vercel) --- wallet-signed writes ---> GenLayer StudioNet
   |                                                        (WitnessMark Intelligent Contract)
   | cached reads / auth / uploads
   v
Backend (Node/Express, Fly.io, 24/7) ---read-only--------> GenLayer StudioNet (via genlayer-js)
   |              |
   v              v
Fly Postgres   Upstash Redis (cache, 30 req/min GenLayer limit)
   |
   v
Cloudinary (evidence file storage -> stable public URL)
```

## Source of truth

| Data | Source of truth |
|---|---|
| Promise financial state (stake, status, verdict, payouts) | **Blockchain** (WitnessMark contract) |
| Promise terms (statement/conditions/evidence requirements) | **Blockchain** (immutable once created) |
| "My promises" list index | **Backend DB**, advisory/derived — rebuildable from `get_party_promise_ids` |
| Evidence file metadata (who uploaded, when, Cloudinary URL) | **Backend DB** |
| Wallet auth sessions | **Backend** (JWT, httpOnly cookie) |
| UI cache | **Frontend only** |

The backend never re-implements financial logic. It is a read-cache and
off-chain-metadata layer in front of a chain that is always authoritative.

## Why a backend exists at all (vs. pure frontend-to-chain)

1. GenLayer StudioNet enforces a 30 requests/minute read limit. A backend
   cache (Redis, short TTLs) absorbs repeated dashboard/list reads so many
   concurrent users don't each hit the RPC directly.
2. Evidence file uploads need a place to land before they have a URL the
   contract can fetch — that's Cloudinary, proxied through the backend so
   API credentials never reach the client.
3. Wallet-signature verification for session auth needs a server-held
   nonce store and JWT secret.

## Components

- **contracts/witnessmark_contract.py** — the `WitnessMark` Intelligent
  Contract. Deployed by the user to StudioNet (never by Claude). See
  `docs/contract.md` (TODO) and `MEMORY.md` for the deployed address.
- **backend/** — Node 20 / TypeScript / Express. Deployed to Fly.io as
  `witnessmark-api`, 24/7 (`min_machines_running=1`, `auto_stop_machines=
  false`, always-restart policy). Talks to Fly Postgres (`witnessmark-db`)
  and Upstash Redis. Read-only against the chain.
- **frontend/** — Next.js (App Router), deployed to Vercel. Wallet connect
  via Reown AppKit; all contract writes are signed client-side via
  genlayer-js using the connected wallet, never proxied through the
  backend.
