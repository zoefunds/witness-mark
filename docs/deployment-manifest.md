# WitnessMark — Deployment Manifest

This is the single authoritative record of what is actually deployed,
versus what the repository's source says should be deployed. Regenerate
the "Verification" section by running:

```bash
cd backend && node scripts/verify-deployment.mjs
```

This script reads the deployed contract's exact source
(`getContractCode`) and public method schema (`getContractSchema`)
directly from the chain and compares them against
`contracts/witnessmark_contract.py` in this repo — it does not trust any
cached or previously-recorded value. It is wired into CI
(`.github/workflows/ci.yml`, job `deployment-verification`) so
source/deployment drift is caught automatically on every push, not
discovered later by a user hitting a missing method or field.

## Current deployment

| Field | Value |
|---|---|
| Contract | `WitnessMark` (single Intelligent Contract — no helper contracts, tokens, factories, registries, or proxies exist anywhere in this system) |
| Chain | GenLayer StudioNet, chain id `61999` |
| Address | `0x181eeE5ff3B1186b39f813129d57558Ad61Ff39B` |
| Deployed by | The project owner directly via `genlayer deploy` (never by an automated agent — see `docs/deployment.md`) |
| Deployment transaction | Not captured at deploy time (deployed outside of any tooling that records it). Retrievable via the [GenLayer Explorer](https://genlayer-explorer.vercel.app) by searching the address, or via `genlayer receipt <txId>` if the tx hash is later located. |
| Source git commit at last verification | `ce20a278b8627de7f739e7bce7e21a81b0600713` |
| Runner dependency pin | `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6` (see the `# { "Depends": ... }` header of `contracts/witnessmark_contract.py`) |

## Verification status — clean

As of 2026-09-13, running `node backend/scripts/verify-deployment.mjs`
against the address above reports:

```
Local source sha256:    26e6b058e71326aa95e45d20f53b1ee1858dae13f424a5835c455826ca940dc5
Deployed source sha256: 26e6b058e71326aa95e45d20f53b1ee1858dae13f424a5835c455826ca940dc5
Source match: YES -- byte-identical
Local source methods:    11 write, 8 view
Deployed schema methods: 11 write, 8 view

PASS: source/deployment match for 0x181eeE5ff3B1186b39f813129d57558Ad61Ff39B
```

The deployed contract is now byte-identical to
`contracts/witnessmark_contract.py` at the commit above — both the full
method inventory and every constant/config value match exactly,
including `get_config()`'s `evidence_late_grace_seconds`,
`high_value_stake_threshold_wei`, and `min_evidence_items_high_value`,
which were the fields missing on the previous deployment (see the
superseded-deployment history below).

## Superseded deployments

- `0x8646e58436bb191680B28b9b85b799C856CfCA64` — the prior deployment.
  Its `get_config()` was missing the 3 fields above (a read-only
  transparency gap, not a behavior difference — those constants were
  already being enforced internally by `submit_evidence` on that
  instance too). Closed by the redeploy above.
- Earlier addresses: `0x0f0f8AF4482880756469Ba02964Aef221C91613e`,
  `0xEb85C80af65d4dF2AD4E796320cDF95Cfac6927F` — see `MEMORY.md` for
  the full history of what each round of fixes corresponded to.

## Full method inventory (from live `getContractSchema`)

Write (11): `create_promise`, `cancel_promise`, `accept_promise`,
`submit_evidence`, `resolve_promise`, `contest_verdict`,
`resolve_contest`, `finalize_promise`, `timeout_unaccepted_reclaim`,
`timeout_no_evidence_reclaim`, `force_refund_undetermined`.

View (8): `get_promise`, `get_promise_summary`, `get_promise_count`,
`get_party_promise_ids`, `get_activity`, `get_platform_stats`,
`get_reputation`, `get_config`.

There is no owner, admin, pause, or privileged-caller method of any
kind — every write method's access control is either restricted to the
two specific parties of a given promise (creator/counterparty) or is
fully permissionless (timeouts, resolution, finalization), by design —
see `contracts/witnessmark_contract.py`'s `WitnessMark` class docstring.

## Frontend / backend configuration wired to this address

| Location | Variable | Value |
|---|---|---|
| `backend/.env` (Fly secret) | `GENLAYER_CONTRACT_ADDRESS` | `0x181eeE5ff3B1186b39f813129d57558Ad61Ff39B` |
| `frontend/.env.local` (Vercel env var) | `NEXT_PUBLIC_CONTRACT_ADDRESS` | `0x181eeE5ff3B1186b39f813129d57558Ad61Ff39B` |

Both confirmed live and reading from this address (`/healthz`, `/readyz`,
and `/api/stats` all verified post-deploy; the site returns 200).

`docs/live-product-tests.md`'s 4-scenario battery has since been re-run
against this exact address (2026-09-13), including a genuine `OVERTURNED`
contest outcome — see that doc for the full run and real tx hashes. The
signed browser E2E (`docs/testing.md`) has separately confirmed the full
lifecycle, including the contest branch, through the real UI against
this same address.
