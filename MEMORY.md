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
- **Current address: `0x8646e58436bb191680B28b9b85b799C856CfCA64`**
  (StudioNet). Fourth deployment, superseding the address below. Wired
  into the Fly secret and Vercel env var on 2026-08-27, both
  redeployed and confirmed live. Database confirmed already clean (all
  tables — `promise_index`, `evidence_files`, `audit_log`, `users`,
  `auth_nonces` — were 0 rows; no prior-contract data existed to clear).
  **Live product-test battery run against this address**: 4 real
  scenarios, 14/14 write transactions ACCEPTED, zero failures — see
  `docs/live-product-tests.md` for full detail with real tx hashes, and
  `backend/scripts/run-product-tests.cjs` / `product-test-report.json`
  for the runnable script and raw output. One incidental promise (id 0,
  "Validation ping") also exists from a pre-flight pipeline check before
  the 4 real scenarios — it's a harmless, successfully-created CREATED-
  status promise, left as-is since its creator's ephemeral key wasn't
  retained to cancel it, and it caused no error.
- **Prior address (superseded): `0x0f0f8AF4482880756469Ba02964Aef221C91613e`**
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
- Deployed by the user themselves every time (as required — Claude never
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

## External review round 5 fixes (2026-08-27)
Fifth audit round scored 17/20, with engineering/UX flagged for stale
docs and no public git history. All addressed:

- **Git repo initialized and pushed to GitHub**: no repo existed before
  this round (`git init` from scratch). 6 logical commits (contract,
  backend, frontend, CI, docs, memory) pushed to
  https://github.com/zoefunds/witness-mark (private), per explicit user
  instruction with no Claude attribution in commit messages. Verified no
  secrets in tracked history (`git grep` for known credential values —
  clean; `.env`/`.env.local` confirmed `!!` ignored by `git status
  --ignored`).
  - **CI shows `startup_failure` with 0 jobs created on GitHub** despite
    the workflow YAML being valid (`python3 -c "import yaml; yaml.safe_
    load(...)"` passes; `gh api .../workflows` shows it registered as
    `active`). `gh api .../check-runs` returns 0 check runs — GitHub
    never got as far as creating jobs. This pattern (valid workflow,
    zero jobs, no logs available) is consistent with a GitHub Actions
    minutes/billing setting on this private repo/account, not a defect
    in `ci.yml` — every command in it (`genvm-lint`, `gltest`, backend
    `npm run test`/`build`, frontend `npm run lint`/`test`/`build`) has
    been independently verified passing locally in this session. **The
    user needs to check GitHub Settings → Billing → Actions** on the
    `zoefunds` account/repo; not something fixable from this environment.
- **Root `README.md` created** (didn't exist before) — live URLs,
  contract address, architecture summary, quick-start per component, doc
  index, and an honest test-coverage summary.
- **`backend/README.md` created** (didn't exist before) — env vars,
  scripts, structure, deployment pointer.
- **`frontend/README.md` replaced** — was still the default
  `create-next-app` boilerplate ("bootstrapped with create-next-app...").
  Now real: env vars, scripts, structure.
- **`frontend/FRONTEND_STATUS.md` and `INTEGRATION_NOTES.md` corrected**
  — both still said wallet-auth was "not wired up" and evidence upload
  used `{url: string}`/single-`file`-field shapes, which were true when
  those files were first written (before round 2's `useAuth.ts` and
  route-shape reconciliation) but had never been updated since. Rewrote
  both to describe actual current behavior.
- **`docs/release-checklist.md` added** — contract/backend/frontend/
  cross-cutting checklist, explicit about what's NOT yet on it (E2E
  tests, mobile QA, demo video).
- **Live app independently re-verified via browser** (addressing "I
  could not independently load the public app"): navigated
  witness-mark.vercel.app's landing, `/promises`, and `/promises/new`
  pages — all render correctly, zero console errors on any of them,
  and the "Connect wallet" button genuinely opens the Reown AppKit modal
  with WalletConnect/MetaMask/Trust Wallet/etc. live in production.
- Not attempted this round (explicitly out of scope for a code-fix
  pass, stated honestly rather than attempted and faked): a further
  live contest-to-payout test retry with published tx links, browser
  E2E tests (Playwright/Cypress), mobile QA, and a demo video. All
  listed as open items in `docs/release-checklist.md`.

## External review round 6 fixes (2026-08-27)
Sixth audit round scored 19/20, asking for one proof artifact to make
the frontend score unambiguous: browser E2E, a demo video, or mobile QA.
User explicitly said no screen recording/video needed. Addressed:

- **Real mobile QA pass found a real, meaningful bug**: the header nav
  (`frontend/components/NavHeader.tsx`) was `hidden md:flex` with **no
  mobile fallback at all** — Dashboard/Promises/New Promise were
  completely unreachable on a mobile viewport, no hamburger menu, no
  alternative navigation. Found by actually resizing the browser to a
  mobile viewport and looking, not by reading code. Fixed with a proper
  hamburger button + slide-down panel (`aria-expanded`, `aria-controls`,
  closes on navigation). Frontend rebuilt clean and redeployed.
- **Playwright E2E suite added** (`frontend/e2e/navigation.spec.ts`,
  `playwright.config.ts`), run against the LIVE deployed app (not a
  local/mocked copy), two real browser engines: `desktop-chromium` and
  `mobile` (WebKit — genuine mobile Safari engine via Playwright's
  iPhone 13 profile). **Live-verified 18/18 passing**: every page loads
  with zero unexpected console errors, desktop nav navigates correctly,
  the mobile hamburger menu opens/navigates/closes correctly (a standing
  regression test for the bug above), and "Connect wallet" genuinely
  opens the Reown AppKit modal on both desktop and mobile.
  - Two real test-writing bugs caught and fixed along the way: an
    ambiguous `getByRole("link", {name:"Dashboard"})` locator that
    matched both the header nav AND the footer's own Dashboard link
    (fixed by scoping to the header `<nav>` landmark); and a WebKit-only
    timeout on `/promises/new` caused by testing for the `load` event
    on a page that opens a long-lived WalletConnect relay WebSocket
    (`load` may never fire while that's open — switched to
    `domcontentloaded` + waiting for the header to render, which is what
    the test actually needed to check).
  - Wired into CI as a new `frontend-e2e` job.
- **Honestly scoped, not overclaimed**: this suite does NOT cover a full
  signed-transaction journey (connect → create → accept → upload →
  submit → resolve → contest/finalize) — that needs a wallet-mocking
  harness (an injected EIP-1193 provider backed by a real signing key,
  bridged to a live StudioNet RPC) that wasn't built this round; a
  reasonably complex, genuinely separate piece of infrastructure I chose
  not to fake. Every individual contract operation in that journey IS
  already independently verified live via `gltest` instead — documented
  precisely in `docs/testing.md` so this isn't a silent gap.
- No demo video produced (user explicitly said not needed).
- `docs/testing.md` and `docs/release-checklist.md` updated accordingly.

## External review round 7 fixes (2026-09-13)
A comprehensive brief covering product focus, contract safeguards,
deployment verification, and engineering-quality gaps. Addressed:

- **Product narrowing**: README and landing page now lead with
  non-custodial procurement/delivery assurance as the flagship use case,
  with an explicit "why this can't be a centralized API" argument
  (conflicting incentives between seller/buyer/platform over real money).
  Category default changed to "procurement" in the create-promise wizard.
  General-purpose categories kept as secondary, not removed.
- **Doc contradictions fixed**: `docs/architecture.md`'s stale "docs/
  contract.md (TODO)" (the file has existed for rounds), `frontend/
  FRONTEND_STATUS.md`'s stale "no Playwright coverage" claim (added
  round 6), and a third found in the same pass: a stale `sameSite=lax`
  claim in `docs/security.md` (changed to `none` in round 2). Rewrote
  `FRONTEND_STATUS.md`'s testing bullet to point at `docs/testing.md` as
  the single source of truth instead of restating counts that drift.
- **Architecture diagram added** (`docs/architecture.md`, mermaid) showing
  explicitly that the backend has zero presence on the value-moving path
  — every write is wallet-signed directly against the contract; the
  backend's entire role is cached reads, file upload, and session auth.
- **Deployment verification tooling built**: `backend/scripts/
  verify-deployment.mjs` reads the deployed contract's exact source
  (`getContractSchema`/`getContractCode`) directly from chain and diffs
  it against `contracts/witnessmark_contract.py` — sha256 hash AND full
  method inventory. **It immediately found a real, previously-
  undetected drift**: `get_config()` gained 3 read-only fields
  (`evidence_late_grace_seconds`, `high_value_stake_threshold_wei`,
  `min_evidence_items_high_value`) in source after the currently-
  deployed instance (`0x8646e58436bb191680B28b9b85b799C856CfCA64`) went
  live. Documented precisely, with exact before/after values, in the new
  `docs/deployment-manifest.md` — not a behavior change (those values
  were already enforced internally; only their exposure via the view
  method is new), so a redeploy is a should-do, not an emergency. Wired
  into CI as `deployment-verification` (continue-on-error: true while
  this known gap stands, since a red check here is the tool correctly
  doing its job).
- **Signed-wallet E2E attempted and built**: `frontend/e2e/
  signed-lifecycle.spec.ts` implements a real injected EIP-1193 +
  EIP-6963 test wallet backed by a genuine viem local account (private
  key generated fresh per test, signs/sends for real against StudioNet
  when invoked). **Confirmed by screenshot**: Reown AppKit's connector
  modal does not currently surface this injected/announced wallet as a
  selectable option — it shows only its curated remote-wallet list
  (WalletConnect, Trust, MetaMask, Binance, SafePal). The test calls
  `test.skip()` with this exact explanation rather than failing or
  falsely passing. Documented in `docs/testing.md`'s "Signed E2E"
  section, including what WAS verified (the provider itself is
  correctly constructed) vs. not (no click path to select it exists).
- **New contract-level test**: `test_escrow_conservation_across_cancel`
  in `tests/integration/test_witnessmark_lifecycle.py` — a wei-exact
  balance-delta conservation check (contract balance decreases by
  exactly the stake, creator balance increases by exactly the stake),
  not just a status-field assertion. Writing it surfaced two real,
  separate findings, both documented in `docs/security.md`, neither a
  contract defect:
  1. **StudioNet's balance RPC lags real transaction finality by up to
     ~20-30 seconds**, even after `wait_triggered_transactions=True` on
     the triggering call. Confirmed by direct polling measurement (stale
     at t+10s/t+20s, correct at t+30s). Fixed via a `_poll_until` helper
     rather than a single immediate read.
  2. **A cross-test contamination risk**: this test file's fixtures
     reuse `accounts[0]`/`accounts[1]` as creator/counterparty across
     nearly every test. Combined with the lag above, a balance-delta
     assertion on a shared account can pick up a DIFFERENT test's
     delayed refund landing mid-test (observed for real: a 5 GEN delta
     where 3 GEN was expected, the extra 2 GEN being a sibling test's
     late-arriving refund to the same shared account). Fixed by using a
     dedicated `create_account()` for this specific test instead of a
     shared fixture account.
  - **Full fast suite re-verified after both fixes: 19/19 passing**
    (18/19 in one full run + 1 clean isolated retry after a transient,
    unrelated StudioNet connection reset during that test's own
    contract deployment — infra flakiness, not a code issue).
- **Real Postgres/Redis backend integration tests added**
  (`backend/tests/integration/`, `npm run test:integration`,
  `backend/docker-compose.test.yml` for local dev) — 16 tests against
  ACTUAL Postgres and Redis instances, not mocks: real SQL against the
  real schema, real TTL expiry, real signature verification against a
  real DB-persisted nonce (including cross-account rejection and
  single-use replay rejection), and the evidence-upload/promise-sync
  authorization fixes verified by querying real tables afterward. Only
  the GenLayer chain read and Cloudinary's actual upload call stay
  mocked. Wired into CI (`backend-integration` job, GitHub Actions
  native Postgres/Redis services). Writing this suite found and fixed a
  real test-environment gap: `src/db/pool.ts` requires SSL by default
  unless the connection string says `sslmode=disable` (correct
  production behavior for Fly Postgres) — the test setup now sets this
  explicitly. Also found and fixed: `backend/vitest.config.ts` had no
  `include`/`exclude`, so the default (mocked) unit-test run was picking
  up the new `tests/integration/*.integration.test.ts` files too and
  running them against the wrong (mocked) setup — now explicitly scoped
  to `tests/*.test.ts` only.
- Frontend redeployed (product-copy changes) and confirmed live; backend
  unchanged this round (script/test additions only, no route/behavior
  changes needing redeploy).
- Still genuinely open, stated plainly: a completed signed-transaction
  browser E2E (blocked on AppKit's connector UI, not on the harness
  itself, which works), a redeploy to close the `get_config()` drift,
  scheduled long-running tests for the two multi-day timeout windows
  (would need a deliberately-shortened test build, not attempted this
  round), a larger-N empirical convergence study across more evidence
  types (broken/partial/ambiguous/changed-after-submission), and a
  formal third-party contract audit.

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
