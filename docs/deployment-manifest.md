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
| Address | `0x8646e58436bb191680B28b9b85b799C856CfCA64` |
| Deployed by | The project owner directly via `genlayer deploy` (never by an automated agent — see `docs/deployment.md`) |
| Deployment transaction | Not captured at deploy time (deployed outside of any tooling that records it). Retrievable via the [GenLayer Explorer](https://genlayer-explorer.vercel.app) by searching the address, or via `genlayer receipt <txId>` if the tx hash is later located. |
| Source git commit at last verification | `e4a58768a219994bbe977c722cb27406eb111cf9` |
| Runner dependency pin | `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6` (see the `# { "Depends": ... }` header of `contracts/witnessmark_contract.py`) |

## Verification status — KNOWN DRIFT, documented not hidden

As of 2026-09-13, running `node backend/scripts/verify-deployment.mjs`
against the address above reports:

```
Local source sha256:    26e6b058e71326aa95e45d20f53b1ee1858dae13f424a5835c455826ca940dc5
Deployed source sha256: fe2a33c9dfaaf293270e78ac2862259f5c55401d17639c640bee3d98ad06f3ac
Source match: NO
Local source methods:    11 write, 8 view
Deployed schema methods: 11 write, 8 view   <- method inventory is IDENTICAL
Length: deployed 77722 bytes vs local 77949 bytes (+227)
```

**The full public method inventory (11 write, 8 view) is identical
between source and deployment** — every method a client can call exists
on-chain with the exact same name, parameters, and payability the source
defines. The only difference is 3 extra keys in `get_config()`'s return
dictionary that exist in source but not on the deployed instance:

```python
"evidence_late_grace_seconds": EVIDENCE_LATE_GRACE_SECONDS,
"high_value_stake_threshold_wei": HIGH_VALUE_STAKE_THRESHOLD_WEI,
"min_evidence_items_high_value": MIN_EVIDENCE_ITEMS_HIGH_VALUE,
```

These were added to source as a read-only transparency improvement
(surfacing constants that were already being enforced internally by
`submit_evidence`) after the address above was deployed. They:

- **Do not change any enforcement behavior** — `EVIDENCE_LATE_GRACE_SECONDS`,
  `HIGH_VALUE_STAKE_THRESHOLD_WEI`, and `MIN_EVIDENCE_ITEMS_HIGH_VALUE`
  were already being enforced by the deployed instance's `submit_evidence`
  before this addition; `get_config()` simply didn't expose their values
  for a client to read ahead of time.
- **Do not add, remove, or change any write method's behavior, parameters, or access control.**
- Are read via `frontend/lib/types.ts`'s `ProtocolConfig`, which already
  marks these three fields optional specifically because of this known
  gap (`evidence_late_grace_seconds?: number`, etc.) — the frontend
  degrades to a hardcoded fallback constant matching the contract's own
  value when they're absent (see `frontend/lib/actions.ts`'s
  `evidenceLateGraceSeconds()`), so this drift causes no incorrect
  behavior in the live app today.

**This is a redeploy decision, not an emergency fix** — closing it
requires the project owner running `genlayer deploy` again (per this
project's standing policy that only the owner deploys, never an
automated agent) and updating the address everywhere per
`docs/deployment.md`. Until that happens, `verify-deployment.mjs` and
the CI job wired to it will correctly and intentionally report `FAIL`
for the byte-hash comparison — that is the check working as designed,
not a broken pipeline. The next redeploy should re-run this manifest's
generation and update the git commit / hash values above.

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
| `backend/.env` (Fly secret) | `GENLAYER_CONTRACT_ADDRESS` | `0x8646e58436bb191680B28b9b85b799C856CfCA64` |
| `frontend/.env.local` (Vercel env var) | `NEXT_PUBLIC_CONTRACT_ADDRESS` | `0x8646e58436bb191680B28b9b85b799C856CfCA64` |

Both confirmed live and reading from this address (see
`docs/live-product-tests.md` for a full real-transaction battery run
against it).
