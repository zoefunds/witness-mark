# WitnessMark — Security Notes

## Threat model summary

- **Wallet custody**: none. Wallet-auth only (Reown AppKit / injected
  provider). The backend never generates, stores, or has access to a
  private key. Every value-moving transaction is signed client-side.
- **Session auth**: nonce/challenge/signature (see `backend/src/lib/
  auth.ts`), single-use nonce, JWT in an httpOnly cookie. `sameSite` is
  `none` (paired with `secure`) in production specifically because the
  frontend and API are different registrable domains (`witness-
  mark.vercel.app` / `witnessmark-api.fly.dev`) — a cross-site fetch
  silently drops a `lax` cookie, which would have broken auth even with
  the flow correctly wired; `lax` is used only in local dev over plain
  HTTP. No password to leak.
- **Secrets**: Cloudinary keys, Redis URL, JWT secret live only in Fly
  secrets (backend) and are never sent to the client. `NEXT_PUBLIC_*`
  frontend env vars are, by design, public (Reown project ID, contract
  address, API URL) — nothing sensitive is prefixed `NEXT_PUBLIC_`.
- **Double settlement / reentrancy**: prevented at the contract level by
  the zero-ledger-then-transfer ordering on every payout path (see
  contract file header comment and `_payout_for_band`). The backend has no
  authority over settlement — it cannot trigger or block a payout.
- **Evidence-content prompt injection**: the adjudication prompt
  (`_build_adjudication_prompt` in the contract) explicitly separates
  immutable contract-defined promise terms from untrusted fetched
  evidence, and instructs the model to ignore any embedded instructions in
  evidence content. Evidence can never redefine what was promised.
- **Malicious uploads**: Cloudinary upload is size-capped (15MB) and typed
  by content, not filename. Uploaded files never execute; they are only
  ever referenced by URL from the contract's own fetch.
- **Rate limiting**: general API abuse protection via `express-rate-limit`
  (120 req/min/IP) on the backend, independent from the GenLayer-specific
  30 req/min cache layer in `src/lib/redis.ts`.
- **CORS**: locked to `CORS_ORIGIN` (the deployed frontend origin), not
  wildcard, in production.
- **SQL injection**: all Postgres access uses parameterized queries (`pg`
  with `$1`/`$2` placeholders) — no string-built SQL anywhere.
- **Backend compromise blast radius**: even a fully compromised backend
  cannot move a single wei — it holds no keys and has read-only chain
  access. Worst case is stale/incorrect cached reads or leaked evidence
  metadata, not fund loss.

## Operational note: StudioNet balance-read lag (not a contract defect)

Found while adding `test_escrow_conservation_across_cancel` to the
`gltest` suite (2026-09-13): StudioNet's balance RPC (`getBalance`) can
lag up to ~20-30 seconds behind a transaction's own "ACCEPTED" status —
even with `wait_triggered_transactions=True` on the triggering call,
which correctly waits for the child transfer transaction itself to
settle. A balance read taken immediately after a payout transaction can
therefore appear stale for up to that long. Confirmed by direct
measurement (polling every 10s: stale at t+10s and t+20s, correct at
t+30s) that this is read-side eventual consistency on the RPC, not a
failed or delayed transfer — the exact same on-chain `emit_transfer` call
this project's own live product-test recipients already show real,
non-zero balances from (see `docs/live-product-tests.md`). Anything
reading a balance shortly after a WitnessMark transaction (a monitoring
dashboard, a test, a support script) should poll/retry rather than treat
an immediately-stale read as a failure — see `_poll_until` in
`tests/integration/test_witnessmark_lifecycle.py` for the pattern used
here.

This lag also has a second-order testing implication, also found and
fixed the same day: this test file's fixtures reuse the same handful of
`accounts[]` as creator/counterparty across nearly every test (by
design, to keep the fast suite fast). Combined with the lag above, a
balance-conservation test using a shared account can observe a DIFFERENT
test's delayed refund landing mid-test and mistake it for a conservation
violation — this happened for real while adding
`test_escrow_conservation_across_cancel` (observed a 5 GEN delta where 3
GEN was expected: the extra 2 GEN was `test_cancel_before_acceptance_
refunds_creator`'s refund to the same shared account, landing late). The
fix is generating a dedicated fresh account (`create_account()`) for any
test that asserts on absolute balance deltas, rather than a shared
fixture account — already applied in that test.

## Known gaps / follow-ups before handling large real value

- **No formal third-party contract audit performed** beyond `genvm-lint` +
  manual review against two prior production GenLayer contracts' patterns
  and three rounds of external structured review. Required before any
  mainnet-equivalent deployment — this is the single largest remaining
  gap and cannot be substituted for by more automated testing.
- Test coverage — see `docs/testing.md` for the authoritative, up-to-date
  detail and pass counts (deliberately not repeated here so the two files
  can't drift out of sync). As of this writing: contract lint clean;
  fast `gltest` subset passing live in CI; slow/live-network tests cover
  adversarial prompt-injection resistance (verified working) and an
  empirical verdict-convergence sample, both run for real against
  StudioNet; backend (vitest+supertest) and frontend (vitest) unit suites
  exist and pass. A larger-N convergence study now also exists across
  BROKEN-leaning and compound-condition evidence types (n=5 each, see
  `docs/testing.md`), extending the original n=3 single-fixture sample.
  A signed, real-wallet browser E2E of the full lifecycle also now
  exists and has already found and fixed two real frontend bugs (a
  broken chain-config object and missing transaction-receipt waiting on
  every write) — see `docs/testing.md`'s "Signed E2E" section for current
  status. A full contest-round settlement (`resolve_contest` payout leg)
  has since completed live, both directly via genlayer-js/`gltest`
  (`docs/live-product-tests.md`) and through the browser UI itself
  (`docs/testing.md`'s "Signed E2E" section — `FULFILLED`/`UPHELD`,
  `stake_deposited_wei: 0`, confirmed by reading the promise back from
  the contract). **Still open**: a formal third-party contract audit, and
  a "changed evidence" convergence sweep (evidence that shifts between
  resolve attempts), which needs a controlled mutable evidence server not
  built in this pass.
- **A real client/contract mismatch was found and fixed** (external
  review, 2026-08-27): the frontend was offering the "reclaim stake — no
  evidence" action, and computing the required contest bond, from
  hardcoded/incomplete logic that didn't match the contract's actual
  grace-period and window checks — specifically, it showed the no-
  evidence reclaim action a full `EVIDENCE_LATE_GRACE_SECONDS` (3 days)
  before the contract would actually accept that transaction. The
  underlying transaction would simply have reverted (no funds-loss risk),
  but it's exactly the class of bug that erodes trust in a financial UI.
  Fixed in `frontend/lib/actions.ts` by deriving every time/attempt-gated
  action (`timeout_no_evidence`, `force_refund_undetermined`, `contest`,
  `finalize`) from the same live `get_config()` values (with matching
  fallback constants) the contract itself checks, with regression tests
  added in `frontend/tests/actions.test.ts`.
- Social account connections (Twitter/etc.) should go through OAuth only,
  never free-typed handles, to prevent impersonation — schema
  (`users.twitter_handle`/`twitter_verified`) anticipates this but the
  OAuth flow itself is not yet implemented.
