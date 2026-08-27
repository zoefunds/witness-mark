# Backend integration notes

`lib/api.ts` is the typed client for the WitnessMark backend
(`witnessmark-api.fly.dev` in production; see `backend/src/routes/*.ts`
for the actual route implementations). This file originally documented
*assumed* endpoint shapes written before the backend existed — it has
since been reconciled against the real backend and kept up to date as
both sides changed. If you're reading this expecting a list of
"assumptions to verify," that phase is over; what follows is current
behavior.

## Endpoints, as actually implemented

- `POST /api/auth/nonce` `{ address }` -> `{ message, expiresAt }`
  Wallet-auth challenge (the nonce is embedded inside `message`, a
  SIWE-style string the wallet is asked to sign).
- `POST /api/auth/verify` `{ address, signature }` -> `{ address }`,
  sets an httpOnly session cookie. `sameSite` is `none`+`secure` in
  production (frontend and API are different registrable domains — a
  `lax` cookie would be silently dropped on the cross-site fetch).
- `POST /api/auth/logout` -> `{ ok }`
- `GET /api/auth/session` -> `{ address, user }` or 401.
- `GET /api/promises?role=&status=&address=` -> a bare array of
  `PromiseIndexRow` (the backend's off-chain index, kept in sync via
  `/sync` below — not currently wired into any page; pages read promise
  data directly from the contract instead, since the contract is the
  source of truth per `docs/architecture.md`'s source-of-truth split).
- `POST /api/promises/:id/sync` — tells the backend to refresh its index
  for one promise from a live chain read. The backend derives creator/
  counterparty/title/status/stake from `get_promise()` itself; it does
  NOT trust any of those fields from the request body (a prior version
  did, and that was closed as a security fix — see `MEMORY.md`).
- `POST /api/evidence/upload` (multipart, field `files`, up to 6, plus a
  required `promiseId` field) -> `{ files: [{url, filename, bytes} |
  {error, filename}] }`. Wired in (`app/promises/[id]/evidence/page.tsx`)
  since evidence files need a stable public URL (Cloudinary) before they
  can be included in the `submit_evidence` transaction. The backend
  verifies the caller is the promise's actual on-chain counterparty
  before accepting a file (403 otherwise) and that the promise is in an
  evidence-accepting state (409 otherwise).
- `GET /api/reputation/:address` — not wired into any page; the app reads
  `get_reputation` directly from the contract instead. Could swap to the
  backend for caching if GenLayer's 30 req/min rate limit becomes a
  problem at scale.

## Wallet-auth session flow — implemented

`hooks/useAuth.ts` implements the full connect → nonce → signature →
backend-verified session flow: after wallet connect, it calls
`api.auth.nonce`, prompts a `signMessage`, and calls `api.auth.verify`,
tracking session state (`isAuthenticated`, `checked`, `signingIn`,
`error`) via React state derived from a live `GET /api/auth/session`
check plus the sign-in flow's own result. `app/promises/[id]/evidence/
page.tsx` calls `signIn()` automatically before a file upload if there's
no active session yet, so uploading a file transparently prompts the one
extra (free, gasless) wallet signature it needs.

This session is independent of contract writes — `create_promise`,
`accept_promise`, `submit_evidence`, etc. are all authorized by the
wallet's own transaction signature against GenLayer directly, with or
without a backend session. The backend session exists only for the one
thing that genuinely needs server-side caller identity: attributing an
uploaded evidence file to a specific wallet before it's accepted.

## Cloudinary upload response shape

`{ files: [{url, filename, bytes} | {error, filename}] }` (per-file
results, not a single `{url}`) — see `lib/api.ts`'s `evidence.upload`,
which posts multiple files in one request and returns partial-failure
results per file.

## Environment

`NEXT_PUBLIC_API_URL` is read from `frontend/.env.local`. If unset,
`lib/api.ts` throws a typed `ApiError` on any call rather than silently
failing — the evidence page surfaces this as an inline error rather than
a bare console error.
