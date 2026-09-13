# WitnessMark — Live Product Tests

Four real, distinct product scenarios run against the currently deployed
contract on GenLayer StudioNet, using real accounts, real detailed
promise language, and real live evidence URLs — not placeholder data.
Most recent run: 2026-09-13, against the current deployed address, after
that instance was redeployed to close the `get_config()` drift (see
`docs/deployment-manifest.md`). Run via
`backend/scripts/run-product-tests.cjs`. Full structured output:
`backend/scripts/product-test-report.json` (an earlier run against the
prior contract address is preserved at
`backend/scripts/product-test-report-2026-08-27-0x8646.json` for
history).

**Contract**: `0x181eeE5ff3B1186b39f813129d57558Ad61Ff39B` (StudioNet)

**Result: 14/14 write transactions reached `ACCEPTED` status. Zero
failures, zero reverts.** This run happened to exercise the contest
mechanism's OVERTURNED outcome for real — a genuinely useful, previously
under-demonstrated result (see Scenario 1) — on top of the same breadth
of methods as the first run against the prior address.

## Personas

Fresh accounts generated for this run — different addresses than the
prior run against the previous contract address (StudioNet is gasless,
so none needed funding).

| Account | Role | Address |
|---|---|---|
| Nexus Automation Labs | AI agent operator (creator, S1) | `0xE16DD9eaB4e35EcaAa07033A9bdbD63d242f1762` |
| Vertex Systems Inc. | Client / contester (counterparty, S1) | `0x3437e4cCD50F1107d4989694B87BbA9e63386036` |
| Meridian Components Ltd. | Supplier (creator, S2) | `0x50c566947d3C2611947eCb11E6296E78242875c2` |
| Atlas Manufacturing Co. | Buyer (counterparty, S2) | `0xd969b5E0Fd82a6b60AC6B53a2997A89bCa9cb6C9` |
| Orion Creative Co. | Commissioner (creator, S3) | `0x8aE9a7648a5aA43181394E8e2779E1AF617A931F` |
| Luma Studio | Illustrator (counterparty, S3) | `0xFA16d3306BDf5A7900Ecf68D403F81907eCb862a` |
| Kai Chen | Individual (creator, S4) | `0x22CF8d8C84a71BD8c2e5A7D971aaaca8517e8882` |
| Reyes Fitness Coaching | Accountability partner (counterparty, S4) | `0xA54411163b0eE4c1a18fe43389Be0DD0bEE01d48` |
| Community Watchdog Bot | Third party, no relationship to any promise | `0x2851dF432908950206f149a556C455B216299e8e` |

## Scenario 1 — AI Agent Software Delivery, contest OVERTURNED (promise id 1)

*Verifiable work delivery — and a genuine, live-observed contest
overturn.* Nexus Automation Labs' coding agent promises a live health-
check endpoint for Vertex Systems Inc. Stake: **2 GEN**, contest bond:
**0.3 GEN** (15%).

Evidence: `https://httpbin.org/html` (a real, live, stable public page,
used as a stand-in for the actual deployment target).

| Step | Method | Tx hash | Result |
|---|---|---|---|
| 1 | `create_promise` | `0x41811de3da030ff198e19cc3c5f8fcba5fc5a26f8c7653ed096cc7d2d781574e` | ACCEPTED |
| 2 | `accept_promise` | `0x4ae14e1a4a35573380eb8cdbaf66b5670157ed8863514ca5413c9850f29f76f5` | ACCEPTED |
| 3 | `submit_evidence` | `0x930b77fb473fefb88fd16a11d32f1611c74819f4dd0c6b5ae151c6b03393c3f7` | ACCEPTED |
| 4 | `resolve_promise` | `0x7d967f4bbb84d1697843d7fe3cdbe246a2e57886f9b8decfe699d879d0488985` | ACCEPTED |
| 5 | `contest_verdict` (bonded, by Vertex) | `0x69cf8a950a36586bfa71a77a4edd338930e85df967347f86dc9075a619cdd36d` | ACCEPTED |
| 6 | `resolve_contest` (by the third-party Watchdog account, permissionless) | `0xef9c5903bda458036d9596f93c179e048b0b045841edb760af95d72589245ecd` | ACCEPTED |

**Final state: `BROKEN`, contest outcome `OVERTURNED`.** On the second,
adversarially-framed adjudication round, the model concluded the
evidence — a generic static HTML page (Moby-Dick text via httpbin) — did
not actually demonstrate a live health-check endpoint, reversing the
original verdict. Verbatim reasoning recorded on-chain:

> "The evidence URL (https://httpbin.org/html) returns a static HTML
> document containing a passage from 'Moby-Dick,' which is not a live
> HTTP health-check endpoint as required by the contract... The use of
> httpbin's static endpoint does not satisfy the measurable condition of
> demonstrating a deployed, functional health-check."

The full stake was paid to Vertex (the counterparty) and the contest
bond routed accordingly — both the escrow AND the contest bond settled
in the same `resolve_contest` transaction. `verdict_evidence_hash`:
`7b838fa4b26c77ca0ebb4691b112befc7355543d35f4a7f7358b7e1eb95232df`.

This is real, live evidence that the contest mechanism doesn't just
rubber-stamp the original verdict — an adversarial second look genuinely
changed the outcome, exactly as designed.

## Scenario 2 — High-Value Procurement Shipment (promise id 2)

Stake: **1000 GEN** (`HIGH_VALUE_STAKE_THRESHOLD_WEI`), requiring ≥2
evidence URLs on ≥2 distinct domains. Meridian Components Ltd. promises a
shipment matches an approved sample with a valid certificate of
conformance for Atlas Manufacturing Co.

Evidence: `https://httpbin.org/json` (httpbin.org) +
`https://www.w3.org/` (w3.org) — two independently-hosted sources.

| Step | Method | Tx hash | Result |
|---|---|---|---|
| 1 | `create_promise` | `0x46bf9991081d94eeff533a9f3f586b1066a2641c0758c75adf358a0e81007407` | ACCEPTED |
| 2 | `accept_promise` | `0x526fc589956314506070e916231a879c562f00bcadb3b0666501da694d7ad7a8` | ACCEPTED |
| 3 | `submit_evidence` (2 URLs, 2 distinct domains) | `0xe1a8d4a88cb7199e969d463091d78a14ff4f64772a683b906e5027b740e97e35` | ACCEPTED |
| 4 | `resolve_promise` | `0x6f85d7201fabd848996306339d1de12fcb7fd84ac7eccc5eaace9c8fcd5e3413` | ACCEPTED — landed on **UNDETERMINED** |

**Final state: `UNDETERMINED`** — a legitimate, successful transaction
(no revert). The adjudicator correctly judged generic stand-in evidence
insufficient to corroborate a real shipment/conformance claim. Remains
claimable via `force_refund_undetermined` once its grace period elapses,
or resolvable again with stronger evidence.

## Scenario 3 — Creative Commission, Cancelled (promise id 3)

Orion Creative Co. stakes a commission deposit behind a planned
illustration package with Luma Studio, then withdraws before acceptance.
Stake: **0.25 GEN**.

| Step | Method | Tx hash | Result |
|---|---|---|---|
| 1 | `create_promise` | `0x75f4901062f90e50230688d9e3137b11db8d577dee01554ae9e3ddb28a52cedb` | ACCEPTED |
| 2 | `cancel_promise` | `0xde2c3ae708d3dcff1a2f0dc980b8feaae8254c32e18f97747242b4b43e941bbe` | ACCEPTED |

**Final state**: `CANCELLED`, full stake refunded to Orion.

## Scenario 4 — Personal Accountability, Accept-Window Timeout (promise id 0)

Kai Chen stakes GEN behind a 30-day fitness accountability commitment
naming Reyes Fitness Coaching as beneficiary, using the minimum allowed
accept window (300s). Reyes never accepts; the unrelated Community
Watchdog account reclaims Kai's stake on Kai's behalf after the window
genuinely elapses, demonstrating the reclaim is truly permissionless.

| Step | Method | Tx hash | Result |
|---|---|---|---|
| 1 | `create_promise` (300s accept window) | `0xcbf86f8db2e2f7a3a97c43847c327e3ae88dabb26fe1ed708e6675fced0223e5` | ACCEPTED |
| — | *(waited for the real 300s window to elapse)* | | |
| 2 | `timeout_unaccepted_reclaim` (called by Watchdog, not Kai) | `0x3ae3a2632bb16eb66a9f652a95a39800db5cbb07b3b453450951714decb9f1f6` | ACCEPTED |

**Final state**: `TIMEOUT_UNACCEPTED`, full stake reclaimed to Kai.

## Read/view methods exercised

Every view method was called and returned correct, live data throughout
the run: `get_promise`, `get_promise_summary`, `get_promise_count`,
`get_party_promise_ids` (all 9 accounts), `get_activity`,
`get_platform_stats`, `get_config`, and `get_reputation` (4 creator
accounts) — see `backend/scripts/product-test-report.json` for full raw
output.

## Methods not exercised — and precisely why

Three of the contract's 11 write methods are gated by real-time windows
measured in days, and calling any of them before that window elapses
would itself be a reverted transaction:

- **`finalize_promise`** — requires 48h (`CONTEST_WINDOW_SECONDS`) after
  a recorded verdict. Scenario 1 instead settled via `contest_verdict` →
  `resolve_contest`, which reaches the same terminal, fully-paid-out
  state through the identical underlying payout code
  (`_payout_for_band`) without the 48h wait.
- **`timeout_no_evidence_reclaim`** — requires 3 days
  (`EVIDENCE_LATE_GRACE_SECONDS`) past the evidence deadline.
- **`force_refund_undetermined`** — requires 5 exhausted resolve
  attempts AND 3 days past the last activity. Scenario 2's promise is
  left in exactly the `UNDETERMINED` state this method exists to
  eventually recover — a live, genuine candidate for it, not a synthetic
  setup.

These windows are deliberate anti-manipulation design (see
`docs/contract.md`), not bugs.
