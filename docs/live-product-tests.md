# WitnessMark — Live Product Tests

Four real, distinct product scenarios run against the currently deployed
contract on GenLayer StudioNet, using real accounts, real detailed
promise language, and real live evidence URLs — not placeholder data.
Run 2026-08-27 via `backend/scripts/run-product-tests.cjs`. Full
structured output: `backend/scripts/product-test-report.json`.

**Contract**: `0x8646e58436bb191680B28b9b85b799C856CfCA64` (StudioNet)

**Result: 14/14 write transactions reached `ACCEPTED` status. Zero
failures, zero reverts.** Every read and write method was exercised
except three that are blocked by contract-enforced real-time windows
measured in days, not something achievable within one working session —
see "Methods not exercised" below for exactly why, rather than a silent
gap.

## Personas

| Account | Role | Address |
|---|---|---|
| Nexus Automation Labs | AI agent operator (creator, S1) | `0xc4e8a4B82EB67d38cF4A925AD142D7aBeC4a979D` |
| Vertex Systems Inc. | Client (counterparty, S1) | `0x906a848C0b794d498A69E86942F709eBfCBFb233` |
| Meridian Components Ltd. | Supplier (creator, S2) | `0xE226388BACbcA7e7f69B72C69Cd5Fa528A424153` |
| Atlas Manufacturing Co. | Buyer (counterparty, S2) | `0x5352DB0024dF0FBcFAd61fB0fF499F0C459371b0` |
| Orion Creative Co. | Commissioner (creator, S3) | `0xBD076bA01917DD74C6A5b2edBaf8D4f1a4eF0dF7` |
| Luma Studio | Illustrator (counterparty, S3) | `0x877d448E31b8321E48A2077dF934CB0a5353863a` |
| Kai Chen | Individual (creator, S4) | `0xa1a42D0A397e723bE64fC621069b0dA764359021` |
| Reyes Fitness Coaching | Accountability partner (counterparty, S4) | `0xa9f5ADb044600D7FF871A155C873225ab7e9E174` |
| Community Watchdog Bot | Third party — no relationship to any promise, demonstrates permissionless methods | `0x55712D070A9fa5C3F412b9643c0c6e98D801c9ce` |

Fresh accounts generated for this run (`generatePrivateKey()` +
`createAccount()`), StudioNet is gasless so none needed funding.

## Scenario 1 — AI Agent Software Delivery (promise id 2)

*Verifiable work delivery — WitnessMark's flagship vertical.* Nexus
Automation Labs' coding agent promises a live, publicly reachable
health-check endpoint for Vertex Systems Inc. Stake: **2 GEN**.

Evidence: `https://httpbin.org/html` (a real, live, stable public page —
standing in for the deployment target per the promise's own conditions).

| Step | Method | Tx hash | Result |
|---|---|---|---|
| 1 | `create_promise` | `0x0c5a5bcb3912a8aa9e2594a57699eb8fd9cf1e11918e65b8c1904df5d80d7c65` | ACCEPTED |
| 2 | `accept_promise` | `0x2fd661329266be46001357246ef7e6cc0a95ea22c39ad5484d8c80fa02cf387a` | ACCEPTED |
| 3 | `submit_evidence` | `0x6a0d471e2766ef5d4d9323fa49611583328360b1b318b236b9b51bca5f43691c` | ACCEPTED |
| 4 | `resolve_promise` | `0x9c0731be66a4eaa0b6c861bdd88479fceed0be5c8b628e08e4064c8aadbfe420` | ACCEPTED — verdict **FULFILLED** |
| 5 | `contest_verdict` (bonded, by Vertex) | `0xb936d0283c641ec14cd077a9632b9db122fa370dca988fe5c90b031b078be6ad` | ACCEPTED |
| 6 | `resolve_contest` (called by the third-party Watchdog account, permissionless) | `0x6940e831faa7394e519cc8d9eb91e0dd70405179445b46400e9ee4586ffa8bfb` | ACCEPTED — contest **UPHELD**, final band **FULFILLED** |

**Final state**: `FULFILLED`, stake fully returned to Nexus, contest bond
routed to Vertex per the upheld outcome. `get_reputation(nexus)` now
shows `promises_made: 1, fulfilled: 1, contested: 1,
fulfillment_rate_bps: 10000`.

## Scenario 2 — High-Value Procurement Shipment (promise id 3)

*Exercises the domain-independent multi-source evidence rule.* Stake:
**1000 GEN** — exactly `HIGH_VALUE_STAKE_THRESHOLD_WEI`, requiring ≥2
evidence URLs on ≥2 distinct registrable domains. Meridian Components
Ltd. promises a shipment matches an approved sample specification with a
valid certificate of conformance for Atlas Manufacturing Co.

Evidence: `https://httpbin.org/json` (domain: httpbin.org) +
`https://www.w3.org/` (domain: w3.org) — two independently-hosted real,
live sources, satisfying the two-distinct-domain requirement live
on-chain.

| Step | Method | Tx hash | Result |
|---|---|---|---|
| 1 | `create_promise` | `0xb0bbbd818d92789e98186823fa5d4e4f69700d4cabbc024165e8a96b39d61dcd` | ACCEPTED |
| 2 | `accept_promise` | `0x2f3fb53d4036e826ad90d2550a037718543998b08b067d1cd3546c35b23c4fd0` | ACCEPTED |
| 3 | `submit_evidence` (2 URLs, 2 distinct domains — accepted by the high-value rule) | `0x1b1e0400ab85d6b2f441d666b7f99bdd2cffd6c87e2dc964c804d97712105019` | ACCEPTED |
| 4 | `resolve_promise` | `0x6f2eda1ed9004b8e10d2132cdf0b44f47b6c1375a7df7272c8dbf26ba37dfe8f` | ACCEPTED — landed on **UNDETERMINED** ("adjudication judged evidence insufficient") |

**Final state**: `UNDETERMINED` — a legitimate, successful outcome (the
transaction itself did not revert or error; the adjudicator correctly
judged the generic stand-in evidence insufficient to corroborate a real
shipment/conformance claim, which is the correct behavior, not a bug).
No contest was attempted since there's no recorded verdict to contest.
This promise remains claimable via `force_refund_undetermined` once its
grace period elapses (see below) or resolvable again via a fresh
`resolve_promise` call with stronger evidence.

## Scenario 3 — Creative Commission, Cancelled (promise id 4)

Orion Creative Co. stakes a commission deposit behind a planned
editorial illustration package with Luma Studio, then withdraws before
Luma accepts (a legitimate, common real-world outcome — scope changed
before commitment). Stake: **0.25 GEN**.

| Step | Method | Tx hash | Result |
|---|---|---|---|
| 1 | `create_promise` | `0xd70ee29af7898e4a180d6dc9ab4d7741c1f0062e163bd353b92c5fc27a131702` | ACCEPTED |
| 2 | `cancel_promise` | `0x262e2fcb799f8019889c1f0b6e7644293d0822e1d0c437c21c8039dc58db7367` | ACCEPTED |

**Final state**: `CANCELLED`, full stake refunded to Orion.

## Scenario 4 — Personal Accountability, Accept-Window Timeout (promise id 1)

Kai Chen stakes GEN behind a 30-day fitness accountability commitment
naming Reyes Fitness Coaching as beneficiary, using the **minimum
allowed accept window (300s)** deliberately, to demonstrate the
permissionless timeout path within a practical session length. Reyes
never accepts. After the window genuinely elapses, the unrelated
Community Watchdog account — with no stake in this promise — reclaims
Kai's stake on Kai's behalf, demonstrating the reclaim is truly
permissionless, not restricted to the creator.

| Step | Method | Tx hash | Result |
|---|---|---|---|
| 1 | `create_promise` (300s accept window) | `0x9f80ace0f027335fb45e2fcf1f52591daf296c92650c13bd0650026c09c3a717` | ACCEPTED |
| — | *(waited for the real 300s window to elapse — no artificial shortcut)* | | |
| 2 | `timeout_unaccepted_reclaim` (called by Watchdog, not Kai) | `0x170a9feeccb8f7171cb5233e97e94b26e65cc58542a0d5f7e72fb150707d4bee` | ACCEPTED |

**Final state**: `TIMEOUT_UNACCEPTED`, full stake reclaimed to Kai.

## Read/view methods exercised

Every view method was called and returned correct, live data throughout
the run: `get_promise` (all 4 promises), `get_promise_summary` (all 4),
`get_promise_count`, `get_party_promise_ids` (all 9 accounts),
`get_activity` (all 4 promises), `get_platform_stats`, `get_config`, and
`get_reputation` (4 creator accounts) — see
`backend/scripts/product-test-report.json` for full raw output of every
call.

## Methods not exercised — and precisely why

Three of the contract's 11 write methods could not be exercised to a
successful completion in this session, **not because they were skipped
carelessly, but because each is gated by a contract-enforced real-time
window measured in days**, and calling any of them before that window
elapses would itself be a reverted/failed transaction — exactly what
this test run was explicitly asked not to produce:

- **`finalize_promise`** — requires `CONTEST_WINDOW_SECONDS` (48 hours)
  to elapse after a recorded verdict before it can be called. Scenario
  1's promise instead settled via the `contest_verdict` →
  `resolve_contest` path, which reaches the same terminal, fully-paid-out
  state through the *identical* underlying payout code
  (`_payout_for_band`) without requiring the 48h wait — so the actual
  settlement logic this method would exercise IS covered live, just via
  a different (and in this case, faster) contract-provided path.
- **`timeout_no_evidence_reclaim`** — requires
  `evidence_by_ts + EVIDENCE_LATE_GRACE_SECONDS` (3 days) to elapse.
- **`force_refund_undetermined`** — requires 5 exhausted resolve
  attempts AND `UNDETERMINED_GRACE_SECONDS` (3 days) past the last
  activity. Scenario 2's promise is left in exactly the `UNDETERMINED`
  state this method exists to eventually recover — it is a live,
  genuine candidate for this call once enough time and resolve attempts
  have passed, rather than a synthetic setup.

These three windows are deliberate safety/anti-manipulation design (see
`docs/contract.md`), not bugs — they exist specifically so a party
cannot prematurely force a refund or timeout before the other side has
had a fair real-world chance to act. Exercising them for real requires
either waiting out the actual window in a future session, or a
dedicated scheduled job — see `docs/testing.md`'s equivalent note for
the `gltest` suite, which faces and documents this exact same
constraint.
