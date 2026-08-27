# WitnessMark — Intelligent Contract

`contracts/witnessmark_contract.py` — `class WitnessMark(gl.Contract)`.
1500+ lines, 19 public methods (11 write, 8 view), 0 constructor params.
Validated clean with `genvm-lint check contracts/witnessmark_contract.py
--json`. Deployed instance address: see `MEMORY.md`.

## State machine

```
CREATED --accept_promise--> ACCEPTED --submit_evidence--> EVIDENCE_SUBMITTED
   |                            |                              |
   |timeout_unaccepted_reclaim  |timeout_no_evidence_reclaim    |resolve_promise
   v                            v                              v
TIMEOUT_UNACCEPTED      TIMEOUT_NO_EVIDENCE              VERDICT_PENDING <-> UNDETERMINED
   |                                                      (contest_verdict)      |
   |cancel_promise (only from CREATED)                        |          force_refund_undetermined
   v                                                           v                |
CANCELLED                                              CONTESTED                v
                                                              |     TIMEOUT_UNDETERMINED_REFUND
                                                   resolve_contest
                                                              |
                                        finalize_promise      v
                                              |     FULFILLED / PARTIALLY_FULFILLED / BROKEN
                                              v
                                  FULFILLED / PARTIALLY_FULFILLED / BROKEN
```

Every terminal state zeroes `stake_deposited_wei` (and
`contest_bond_deposited_wei` where relevant) before the corresponding
transfer — see `_payout_for_band` and `_settle_contest`.

## Financial flow

1. `create_promise` (payable) — creator stakes GEN as `gl.message.value`.
2. `accept_promise` — counterparty accepts, no funds move.
3. `submit_evidence` — counterparty submits evidence URLs; deadline-
   enforced (see below); high-value promises require ≥2 sources.
4. `resolve_promise` — permissionless; runs consensus adjudication
   (`_adjudicate_promise_nondet`); records a verdict but does NOT pay out.
5. `finalize_promise` — permissionless, only after the 48h contest window;
   pays out per the recorded verdict.
6. `contest_verdict` (payable, 15% of stake) — either party, within the
   contest window, forces one adversarial re-adjudication.
7. `resolve_contest` — permissionless; pays out per the upheld/overturned
   verdict, routing the contest bond first.
8. Timeout/recovery exits — `cancel_promise`,
   `timeout_unaccepted_reclaim`, `timeout_no_evidence_reclaim`,
   `force_refund_undetermined` — every one independently zero-then-
   transfers, ensuring funds are never permanently stuck.

## Evidence deadline and source-quality rules

- The **first** evidence submission (while still `ACCEPTED`) must land
  within `evidence_by_ts + EVIDENCE_LATE_GRACE_SECONDS` (3 days), or it is
  rejected outright — `timeout_no_evidence_reclaim` becomes callable at
  exactly that same boundary, so there is never a gap where evidence can
  neither be submitted nor the stake reclaimed. Resubmission after the
  first successful submission is not re-gated by this clock.
- A promise staking ≥ `HIGH_VALUE_STAKE_THRESHOLD_WEI` (1000 GEN) requires
  ≥ `MIN_EVIDENCE_ITEMS_HIGH_VALUE` (2) independent evidence URLs — a
  single link cannot settle a large stake.

## Evidence tamper-evidence

Every adjudication computes `verdict_evidence_hash`: a combined sha256
digest over the URL + exact fetched content (image bytes or rendered
text) of every evidence item actually used, computed independently by the
leader AND by every validator's own re-fetch (see
`_combined_evidence_hash`). It is recorded on-chain
(`get_promise().verdict_evidence_hash`) for provenance/audit, but is
**not** a hard consensus-equivalence gate — see the docstring on
`_adjudicate_promise_nondet` for why (ordinary page volatility would
otherwise manufacture spurious leader rotation on evidence a human
wouldn't consider meaningfully changed). If a party suspects tampering,
the recorded hash is concrete grounds to `contest_verdict`.

## Consensus / equivalence design

- The verdict **band** (FULFILLED / PARTIALLY_FULFILLED / BROKEN /
  INSUFFICIENT_EVIDENCE) must match EXACTLY between leader and validator —
  this is the substantive judgment real money is split by.
- The `PARTIALLY_FULFILLED` payout split additionally requires the
  bucketed `creator_payout_bps` to match (10-percentage-point buckets,
  plus a 250bps raw-value tolerance at bucket edges) — wide enough that
  ordinary LLM sampling variance doesn't force needless leader rotation,
  while still requiring the two runs to land in essentially the same
  place before a wei moves.
- Errors are classified with deterministic prefixes (`EXPECTED:`,
  `EXTERNAL:`, `TRANSIENT:`, `LLM_ERROR:`) so a validator's own
  independent failure can meaningfully agree or disagree with the
  leader's, rather than any exception forcing disagreement.

## Known limitation: dispute escalation is application-level, not
GenLayer-native appeal

The single bonded `contest_verdict` / `resolve_contest` round is a
deliberately bounded, application-level escalation ladder. It does not
currently map into GenLayer's protocol-native appeal process (which
expands validator participation for higher-value disputes). For an MVP
this keeps the contract self-contained and auditable; a future revision
could route high-value contests through the native appeal mechanism
instead of (or in addition to) this bonded re-run. See `docs/security.md`
"Known gaps" for the full list.
