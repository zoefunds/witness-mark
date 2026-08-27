# WITNESSMARK — Project Memory

Living memory file for this project. Read this first in any new session.

## What this is
WitnessMark: "Proof of Promise" protocol. A creator stakes GEN behind a
structured, measurable real-world promise naming a counterparty. The
counterparty submits evidence (URLs/images/docs) once the outcome is known.
The GenLayer Intelligent Contract fetches that evidence itself and, via
validator consensus, judges FULFILLED / PARTIALLY_FULFILLED / BROKEN, then
pays the stake out accordingly. Tagline: "Make promises that survive contact
with reality."

## Decisions locked in (do not re-ask unless the user changes their mind)
- Backend/DB: self-managed **PostgreSQL**, deployed as **Fly Postgres** (a
  managed Postgres app on Fly.io, not Docker-on-laptop).
- Backend hosting: **Fly.io** (CLI already installed). Must run 24/7 —
  Fly Machines configured with `auto_stop_machines = false` / min_machines_running >= 1,
  health checks, and restart policy so it never fully stops.
- Auth: **wallet authentication** (MetaMask / any EIP-1193 injected
  provider), connect → nonce challenge → signature → backend-verified
  session. No custodial key generation, no email/password.
- Evidence: **both** file upload (via backend object storage → stable
  public URL) **and** raw URLs. The contract only ever fetches URLs itself
  — never trusts uploaded file content from calldata.
- MVP scope: **general-purpose promises** (one flexible primitive), not
  narrowed to one vertical — matches WITNESSMARK.md's "do not hard-code
  around one marketplace" guidance.
- Frontend deploy target: **Vercel**. Full setup steps needed (not
  preconfigured).
- GenLayer StudioNet wallet: needs setup + funding steps (not preconfigured).
- **The user deploys the contract themselves** — never deploy on their
  behalf. Provide exact `genlayer deploy` commands and wait for them to
  paste back the deployed contract address.
- Socials on user profiles are connected via OAuth/wallet-linked
  connections, never typed usernames — prevents impersonation of other
  users' social accounts.
- Contract must be production-scale (~1000+ lines), must not be so strict
  that ordinary LLM sampling variance causes constant leader rotation or
  UNDETERMINED consensus results, and must not error with "could not load
  contract schema" on deploy.

## Reference projects this build draws on
- `/Users/macbook/ic4/DeliveryVault/contracts/delivery_vault.py` — escrow
  ledger pattern (`_wei` vs `_deposited_wei`), zero-then-transfer ordering,
  band-verdict + bucketed bps payout split, bonded single-round contest
  ladder, tracking/web-fetch independent evidence path, timeout/recovery
  exits. Scored 560 pts.
- `/Users/macbook/Witness-Weaver/contracts/witnessweave_contract.py` —
  multi-evidence-URL fetch + image/text classification, wide-tolerance
  leader/validator equivalence (`_results_agree`), structured error-prefix
  classification (EXPECTED/EXTERNAL/TRANSIENT/LLM_ERROR), permissionless
  evaluation trigger, per-claimant independent bond refund. Scored 480 pts.
- `/Users/macbook/ic4/DeliveryVault/docs/*` — review/decision-record docs
  worth reading for what graders scrutinized.
- Builder resources brief: `~/Downloads/new/builder-resources.md` (and a
  duplicate under `~/iCloud Drive (Archive)/Documents/`) — canonical
  GenLayer skills/workflow guidance (skills.genlayer.com, equivalence
  principle, genvm-lint, direct/integration tests, deployment commands).

## Contract
- File: `contracts/witnessmark_contract.py` — `WitnessMark(gl.Contract)`.
- 1497 lines, 19 public methods (11 write, 8 view), 0 constructor params.
- Validated with `genvm-lint check contracts/witnessmark_contract.py --json`
  → clean pass (contract loads, schema generates) as of 2026-08-27, pinned
  to `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6` (the
  same pin both reference contracts above used successfully — a newer
  runner exists but errored locally with "No module named 'genlayer.py'",
  so stayed on the proven pin; revisit if StudioNet requires the newer one).
- Consensus tolerance is deliberately wide (band must match exactly since
  that's what real money is split by, but PARTIALLY_FULFILLED payout_bps
  uses a 1000-bps bucket **plus** a 250-bps raw-value tolerance at bucket
  edges) specifically so ordinary LLM sampling variance doesn't force
  leader rotation / UNDETERMINED — per explicit user instruction.
- Money-shaped and list-shaped public method params always use plain
  str/int/bool (JSON-encoded strings for arrays), never u256/list/dict
  directly — this + mirroring the exact decorator/base-class pattern of the
  two proven contracts is the main defense against a schema-load error.

## Secrets / infra credentials (values live in gitignored .env files only)
- Cloudinary (`backend/.env`: CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET) —
  evidence file upload storage. Uploaded files get a stable public
  Cloudinary URL, which is what gets passed into the contract's
  `submit_evidence(evidence_urls_json, ...)` — the contract fetches that
  URL itself; raw file bytes never touch calldata.
- Reown (WalletConnect AppKit) project ID — `REOWN_PROJECT_ID` in both
  `backend/.env` and `frontend/.env.local` (`NEXT_PUBLIC_REOWN_PROJECT_ID`,
  fine to expose client-side, that's normal for AppKit). Powers the wallet
  connect UI (injected MetaMask-style + WalletConnect QR) for the
  wallet-auth flow.
- Upstash Redis (`REDIS_URL` in `backend/.env`) — cache layer in front of
  GenLayer view-call reads. **GenLayer StudioNet rate-limits to 30
  requests/minute** — the backend must cache read-heavy endpoints
  (promise list/detail, reputation, platform stats) with a short TTL
  (~30–60s) rather than hitting the RPC on every page load. Also: **use
  Redis sparingly** — cache only what's actually read-heavy, avoid
  per-request Redis round-trips for things that could be computed
  in-process, to avoid burning through the free-tier credit.
- All of the above are placeholders in `*.env.example` files (safe to
  commit) and real values only in `.env` / `.env.local` (gitignored).
  `SESSION_JWT_SECRET` and GenLayer RPC/contract-address values are still
  empty — fill in once generated / once the user deploys the contract.

## Deployed contract
- **Current address: `0x0f0f8AF4482880756469Ba02964Aef221C91613e`**
  (StudioNet). This is the SECOND deployment — the user redeployed after
  the round-2 review fixes (evidence deadline enforcement, evidence
  tamper-evidence hashing, domain-independent two-source rule). Live-
  verified via a direct `get_config()` read before wiring in. Wired into
  the Fly secret `GENLAYER_CONTRACT_ADDRESS` (`fly secrets set -a
  witnessmark-api ...`, which auto-redeploys) and the Vercel prod env var
  `NEXT_PUBLIC_CONTRACT_ADDRESS` (`vercel env add ... --force`, then a
  fresh `vercel deploy --prod`). Both confirmed live against the new
  address as of this update.
- **Prior address (superseded): `0xEb85C80af65d4dF2AD4E796320cDF95Cfac6927F`**
  — the original deployment, predates the round-2 contract fixes. No
  longer referenced by the live app; kept here only for history/audit
  trail.
- Deployed by the user themselves both times (as required — Claude never
  deploys the contract). `GENLAYER_RPC_URL` left empty deliberately —
  genlayer-js ships a built-in studionet chain config; only set an
  explicit RPC URL if that stops being sufficient.
- **Note:** the deployed contract's `get_config()` does NOT yet include
  `evidence_late_grace_seconds` / `high_value_stake_threshold_wei` /
  `min_evidence_items_high_value` — those three keys were added to
  `get_config()`'s return dict in source *after* this second deployment
  (a transparency nice-to-have, not a behavior change — the underlying
  rules were already enforced either way). Harmless to leave as-is; pick
  it up on the next redeploy if one happens for another reason.

## Backend deployment (live)
- Fly app: **witnessmark-api** (org "personal"), region `iad`.
  https://witnessmark-api.fly.dev — `/healthz` and `/readyz` both green,
  `/api/stats` confirmed proxying a live read from the deployed contract.
- **Fly Postgres**: app `witnessmark-db` (unmanaged Fly Postgres, 1-node
  cluster, `shared-cpu-1x`, 1GB volume). Attached to `witnessmark-api` via
  `fly postgres attach`, which auto-set the `DATABASE_URL` secret (db name
  `witnessmark_api`, user `witnessmark_api`). Schema applied via
  `node dist/db/migrate.js` over `fly ssh console`.
- 24/7 config in `backend/fly.toml`: `min_machines_running = 1`,
  `auto_stop_machines = false`, `[[restart]] policy = "always"`, health
  check on `/healthz` every 15s. If Fly ever needs a redeploy, run
  `fly deploy` from `backend/`; if migrations need to be re-run,
  `fly ssh console -a witnessmark-api -C "node dist/db/migrate.js"`.
- All secrets (`GENLAYER_CONTRACT_ADDRESS`, `CLOUDINARY_*`, `REDIS_URL`,
  `SESSION_JWT_SECRET`, `REOWN_PROJECT_ID`, `CORS_ORIGIN`) are set as Fly
  secrets on `witnessmark-api`, not baked into the image — mirrors
  `backend/.env` locally. `CORS_ORIGIN` is set to
  `https://witness-mark.vercel.app` (the frontend's Vercel domain, per
  explicit user instruction) — update this Fly secret if that domain ever
  changes.
- Backend is READ-ONLY against the chain (`src/lib/genlayer.ts` only ever
  calls `readContract`) — it never holds a private key and never signs a
  transaction. Every state-changing contract call is signed client-side by
  the connecting user's own wallet in the frontend.

## Frontend deployment (live)
- **Live at https://witness-mark.vercel.app** (Vercel project
  `witness-mark`, team/scope `adebiyi2002gmailcoms-projects`, prod alias
  confirmed, all pages spot-checked 200). Deploy with:
  `cd frontend && vercel deploy --prod --yes --scope adebiyi2002gmailcoms-projects`
  (the `vercel env add`/`vercel env ls` commands hang past ~15s on this
  machine for reasons unclear — always background them with a ~12–15s
  kill-guard rather than letting the tool call block indefinitely).
- Vercel production env vars set (`NEXT_PUBLIC_*`, matching
  `frontend/.env.local`): `NEXT_PUBLIC_REOWN_PROJECT_ID`,
  `NEXT_PUBLIC_API_URL=https://witnessmark-api.fly.dev`,
  `NEXT_PUBLIC_GENLAYER_CHAIN_ID=61999`,
  `NEXT_PUBLIC_GENLAYER_RPC_URL=https://studio.genlayer.com/api`,
  `NEXT_PUBLIC_CONTRACT_ADDRESS=0xEb85C80af65d4dF2AD4E796320cDF95Cfac6927F`.
- Built by a background agent from the four HTML mockups + DESIGN.md: all
  10 planned pages (landing, dashboard, promises list, 5-step create
  wizard, promise detail with all 13 statuses, evidence submission,
  adjudication view, reputation profile, wallet/settings, error/empty/
  loading states throughout). Wax-seal/notarization-mark logo + favicon.
  Wallet via Reown AppKit + wagmi/viem; contract I/O via `genlayer-js`
  wired to the exact method names in `contracts/witnessmark_contract.py`.
- **Fixed after the agent's handoff** (see `frontend/lib/api.ts`,
  `frontend/lib/types.ts`, and the evidence page): the agent had *assumed*
  backend response shapes since the backend wasn't built yet at the time.
  Reconciled against the real backend:
  - `evidence_urls` on a promise is a **flat array of URL strings**
    (matches `_promise_dict()` in the contract), not `{url, kind}`
    objects — the agent had guessed the object shape; both the promise
    detail page and the evidence page were rendering `item.url` on plain
    strings, which would have shown `undefined`. Fixed.
  - `/api/evidence/upload` takes multipart field **`files`** (plural, up
    to 6) plus a required **`promiseId`** field, and returns
    `{ files: [{url,filename,bytes} | {error,filename}] }` — the agent had
    assumed a single `file` field returning `{url}`. Fixed to batch-upload
    and surface partial-failure results per file.
  - `/api/promises` (list) returns a **bare array**, not `{promises:[...]}`
    — fixed in the typed client (this endpoint isn't wired into any page
    yet either way; pages read directly from the contract, which is
    correct per the source-of-truth split in `docs/architecture.md`).
  - `/api/auth/nonce` returns `{message, expiresAt}` (no separate `nonce`
    field — it's embedded in `message`); `/api/auth/verify` only needs
    `{address, signature}`, not a third `message` field. The full
    connect→nonce→sign→verify session flow is still **not wired into any
    page** (noted by the agent in `frontend/INTEGRATION_NOTES.md`) — not
    required for core functionality since every contract write is
    authenticated by the wallet's own transaction signature, independent
    of any backend session. Worth wiring in as a fast-follow once
    server-side per-user attribution actually needs it.
  - Rebuilt (`npm run build`) clean after all fixes before deploying.

## External review round 2 fixes (2026-08-27) — contract redeploy still pending
An external audit re-scored the project 2830→3440/4000 after round-1 fixes,
then flagged round-2 items. All addressed in source; **the live production
contract at `0xEb85C80af65d4dF2AD4E796320cDF95Cfac6927F` has NOT been
redeployed with these contract-level changes yet** — that requires the
user to run `genlayer deploy` again and hand back the new address (see
`docs/deployment.md`). Backend/frontend fixes ARE already live.

- **Evidence-hash claim corrected in comments/docstrings.** The hash was
  never actually a validator-agreement gate (band/payout bucket are the
  only gated fields) — the code was already right, but the docstring on
  `_combined_evidence_hash` and the `Promise.verdict_evidence_hash` field
  comment overclaimed that a hash mismatch "alone is enough to make the
  round disagree." Rewritten to state plainly: computed independently by
  leader + every validator, but only carried through to storage for
  audit/provenance, not compared for equality. `_adjudicate_promise_nondet`'s
  own docstring already had this right and needed no change.
- **"Two independent sources" now actually means independent domains.**
  Added `_registrable_domain()` (URL hostname heuristic + a small
  hardcoded set of known two-label ccTLD suffixes like `co.uk` — NOT a
  full public suffix list, documented as such) and changed the
  high-value-promise rule in `submit_evidence` to require
  `MIN_EVIDENCE_ITEMS_HIGH_VALUE` URLs across that many DISTINCT
  registrable domains, not just that many URLs.
- **Evidence upload authorization closed.** `backend/src/routes/
  evidence.ts` `/upload` now reads the promise from chain (cached, same
  pattern as `promises.ts`) and rejects with 403 unless the authenticated
  caller is the promise's actual on-chain counterparty, and 409 unless the
  promise is in an evidence-accepting status. Previously any authenticated
  wallet could upload files tagged to any promiseId.
- **Two new fast, live-verified test cases**:
  `test_cannot_cancel_same_promise_twice` (deterministic, in the "not
  slow" CI subset) and `test_cannot_reclaim_unaccepted_timeout_twice`
  (marked slow — real 5min sleep) — both assert the zero-then-transfer
  ledger guard actually blocks a second payout attempt on the same
  promise via two different exit paths.
- **CI now runs the fast `gltest` subset for real** (`contract-
  integration` job in `.github/workflows/ci.yml`), not just lint — proven
  to work locally (see below) so it's no longer commented out.
- **`docs/security.md` updated** — it previously said "no automated
  integration test suite committed," which was already stale by the time
  of this review; corrected to describe what's actually covered and what
  isn't (see `docs/testing.md` for full detail).
- **Live-verified test results** (genuine `gltest` runs against
  StudioNet, not simulated): the fast (`not slow`) subset passed
  **17/17** before this round's contract changes (859s / 14m19s real
  run). After the round-2 fixes, the suite grew to 18 fast tests (two new
  double-payout invariant tests) and **passed 18/18** (1018s / 16m58s
  real run) — this run also caught and fixed a genuine bug of my own: the
  domain-independence test's "should succeed" case originally used two
  URLs on the SAME domain, which correctly failed once the new
  registrable-domain rule was in place. Fixed the test fixture (now uses
  two distinct domains) and added an explicit same-domain-must-reject
  negative case alongside it. Final state: 18/18 passing.
- Still open (documented, not yet fixed): a full end-to-end contest-
  overturn round, adversarial/prompt-injection evidence tested against a
  live LLM, a leader/validator agreement-rate variance measurement, and a
  third-party contract audit — all listed in `docs/security.md` and
  `docs/testing.md`.

## External review round 3 fixes (2026-08-27)
Third audit round scored 3440→3760/4000. Remaining items, all addressed:

- **`docs/security.md`'s stale "17/17" reference fixed** — it now points
  to `docs/testing.md` as the single source of truth for the pass count
  instead of repeating a number that can drift out of sync.
- **New live-verified slow tests added**, closing the "run and retain
  evidence for slow tests" gap:
  - `test_prompt_injection_in_evidence_is_not_obeyed` — evidence content
    explicitly instructing the model to ignore the promise's real
    conditions and declare FULFILLED. **Verified live: did not work** —
    the contract's Section A/Section B prompt separation held.
  - `test_empirical_verdict_convergence_on_fixed_evidence` — n=3 identical
    promises/evidence, records the observed band distribution.
    **Verified live: 3/3 FULFILLED** (fully converged this run).
  - `test_contest_round_reaches_a_terminal_state` — full
    `contest_verdict` → `resolve_contest` round. Skips gracefully (not a
    failure) if the first `resolve_promise` in that run doesn't land on a
    recorded verdict at all. **Ran 3 times live**: skip (undetermined),
    fail (transient StudioNet `ConnectionResetError`, not a contract bug),
    skip (undetermined) — stopped there deliberately rather than retrying
    indefinitely; see `docs/testing.md`'s full history. The contest bond's
    own validation IS covered live by the fast, deterministic
    `test_contest_requires_exact_bond`; only the `resolve_contest` payout
    leg specifically remains unexercised live, pending a future run that
    happens to land past the first resolve.
  - Two new fast double-payout invariant tests
    (`test_cannot_cancel_same_promise_twice`,
    `test_cannot_reclaim_unaccepted_timeout_twice`) — the fast subset is
    now 18 tests, **re-verified 18/18 live** after this round's contract
    changes too (a second full run, since the round-2 domain-independence
    fix landed in the same window — see below).
- **Real backend test suite added**: `backend/tests/*.test.ts` via
  vitest + supertest, **24/24 passing**. Required refactoring
  `src/index.ts` into `src/app.ts` (testable Express app) +
  `src/index.ts` (just `.listen()` + process signals) so tests can drive
  the app without binding a real port. Every test mocks the DB/Redis/
  GenLayer modules at the boundary. Explicitly regression-tests both
  round-2 fixes: `/api/evidence/upload` rejects non-counterparty callers
  (403) and wrong-status promises (409); `/api/promises/:id/sync` derives
  identity and stored values from a live chain read, proven by asserting
  attacker-supplied body fields never reach the SQL parameters.
- **Real frontend test suite added**: `frontend/tests/*.test.ts` via
  vitest, **20/20 passing**. Covers `lib/actions.ts`'s action-availability
  logic against every status × role combination (mirrors the contract's
  own access control) and `lib/format.ts`'s money/time formatting
  (`weiToGen`/`genToWei` round-trip precision in particular — the exact
  path a stake amount is displayed and submitted through). Adding this
  suite's lint pass caught a real bug: `hooks/useAuth.ts` was calling
  `setState` synchronously inside a `useEffect` body (a React anti-
  pattern flagged by `react-hooks/set-state-in-effect`) — fixed by
  deriving the `checked` flag instead of resetting it eagerly.
- **CI updated** to run `npm run test` in both the backend and frontend
  jobs, alongside the already-enabled fast `gltest` job.
- Backend redeployed (app.ts refactor + evidence/promises fixes from
  round 2 were already live; this deploy adds nothing behavior-changing,
  just confirms the refactor deploys cleanly) and frontend redeployed
  (useAuth fix + verdict_evidence_hash display from round 2). Both
  confirmed healthy post-deploy.
- Contract-level changes this round: none beyond round 2's (evidence
  deadline, tamper-evidence hash, domain-independent two-source rule,
  corrected docstrings, `get_config()` now also exposes
  `evidence_late_grace_seconds`/`high_value_stake_threshold_wei`/
  `min_evidence_items_high_value`). All already deployed to
  `0x0f0f8AF4482880756469Ba02964Aef221C91613e` as of round 2.
- Still open, honestly: a formal third-party contract audit, a
  larger-N statistical convergence study (beyond this round's n=3
  sample), component/DOM and end-to-end browser test coverage on the
  frontend, and backend route tests against a real (non-mocked) Postgres
  instance.

## External review round 4 fixes (2026-08-27)
Fourth audit round scored 3760→ pending re-check. Found one real bug:

- **UI/contract mismatch, found and fixed**: `frontend/lib/actions.ts`
  offered "Reclaim stake (no evidence)" immediately after
  `evidence_by_ts`, but the contract's `timeout_no_evidence_reclaim`
  actually requires `evidence_by_ts + EVIDENCE_LATE_GRACE_SECONDS` (3
  days) — the button would have shown 3 days too early and the tx would
  revert (no funds-loss risk, but a real trust-eroding UX bug). Root
  cause: the frontend action-availability logic didn't check the same
  time/attempt preconditions the contract enforces for ANY of its gated
  actions, not just this one. Fixed comprehensively, not just for the one
  flagged case: `getAvailableActions` now takes an optional live
  `ProtocolConfig` (from `useProtocolConfig()` / `get_config()`) and
  derives `timeout_no_evidence`, `force_refund_undetermined`, `contest`,
  and `finalize`'s availability from the exact same checks the contract
  makes (grace periods, contest window, resolve-attempt exhaustion,
  contest_count), with hardcoded fallback constants only for when config
  hasn't loaded yet. Also fixed the contest-bond calculation on the
  promise detail page, which had the same class of staleness risk
  (hardcoded `CONTEST_BOND_BPS = 1500` instead of reading
  `config.contest_bond_bps`).
  - Note: the currently-deployed contract instance
    (`0x0f0f8AF4482880756469Ba02964Aef221C91613e`) predates
    `get_config()` exposing `evidence_late_grace_seconds` (that field was
    added to contract source *after* this instance's deploy — see the
    round-2 entry above) — so the fallback constant
    (`EVIDENCE_LATE_GRACE_SECONDS_FALLBACK = 259200`, matching the
    contract's own constant) is what's actually in effect right now. This
    is correct today; if/when the contract is redeployed again, the live
    config value takes over automatically with no frontend change needed.
  - 4 new regression tests added in `frontend/tests/actions.test.ts`
    (13→17 test cases in that file, 22/22 total frontend tests passing)
    specifically asserting the exact boundary the bug was on, plus the
    contest-window/contest-count and resolve-attempt-exhaustion cases.
- **`docs/security.md` brought back in sync** with `docs/testing.md`'s
  actual current coverage (it had gone stale again after round 3 added
  the prompt-injection/convergence/contest tests) — also corrected a
  second stale claim found in the same pass: the session cookie doc said
  `sameSite=lax`, but round 2 changed it to `sameSite=none` in production
  (required for the cross-origin vercel.app ↔ fly.dev cookie to work at
  all) and the doc was never updated to match.
- Frontend redeployed and confirmed live (200s on `/` and a promise
  detail route). Backend unchanged this round (no backend code touched).
- Third-party contract audit and a completed live contest-settlement test
  run remain the two genuinely open items — both explicitly out of scope
  for what a code-level fix pass can close; see `docs/security.md`.

## Status log
- 2026-08-27: Discovery Q&A completed (see Decisions above). Contract
  written, linted clean, **deployed by user to StudioNet** at the address
  above. Repo scaffold created at `/Users/macbook/witnessmark`
  (`contracts/`, `frontend/`, `backend/`, `docs/`, `scripts/`, `tests/`).
  Cloudinary/Reown/Upstash Redis credentials received and stored in
  gitignored .env files (see Secrets section). Backend built directly
  (Node/TS/Express + Fly Postgres + Cloudinary + Redis + genlayer-js) and
  **deployed live** to Fly.io. Frontend built by a background agent from
  the four HTML mockups, **reconciled against the real backend contract
  and deployed live** to Vercel. Both verified end-to-end against the
  live deployed contract (CORS confirmed working between the two, `/api/
  stats` proxying a real StudioNet read, all frontend routes 200).
  **The full stack is live end-to-end as of 2026-08-27.** Remaining
  fast-follows (not blocking): wire the wallet-auth session flow into the
  frontend (connect works and gates all writes today; only server-side
  per-user session attribution is missing), fill in `tests/direct` and
  `tests/integration` for the contract, OAuth-based social account linking
  (schema anticipates it, flow not built), `docs/contract.md`/`docs/
  deployment.md`/`docs/testing.md` per the WITNESSMARK.md doc checklist.
