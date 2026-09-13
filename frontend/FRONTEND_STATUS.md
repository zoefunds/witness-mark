# Frontend status

Production frontend for WitnessMark. Next.js 16 (App Router, Turbopack), TypeScript, Tailwind
CSS v4 (theme tokens defined directly in `app/globals.css` via `@theme inline`, mirroring
`DESIGN.md`'s color/type/spacing tokens under the same names: `surface`, `on-surface`,
`primary`, `secondary` (verification green), `tertiary` (caution orange/staked), `error`,
`outline-variant`, etc).

## Run it locally

```bash
cd frontend
npm install
npm run dev
```

Set `frontend/.env.local` (already present, all values filled in — Reown project ID, API URL,
GenLayer chain id/RPC URL, and `NEXT_PUBLIC_CONTRACT_ADDRESS`, pointing at the live deployed
contract; see `MEMORY.md` for the current address). If the contract address is ever unset, the
app degrades gracefully — a "contract not configured" banner and empty states, not crashes.

`npm run lint`, `npm run test` (22 tests), and `npm run build` all pass clean as of this writing.
Live at https://witness-mark.vercel.app.

## What's built

All pages from the brief:

- `/` — landing page: hero, protocol architecture (PROMISE → STAKE → EVIDENCE → ADJUDICATION →
  SETTLEMENT), use-case grid, footer.
- `/dashboard` — connected-wallet overview: promise counts by status, capital staked/returned,
  reputation snapshot, recent promises.
- `/promises` — "my promises" list, filterable by role (creator/counterparty) and status.
- `/promises/new` — 5-step creation wizard (Statement → Subject → Evidence → Stake → Review),
  ending in a wallet-signed `create_promise` transaction with pending/confirming/confirmed/failed
  states.
- `/promises/[id]` — full promise detail: plain-English status explanation (what's happening +
  what happens financially next, per every one of the 13 contract statuses), terms, stake,
  evidence, verdict/reasoning summary, activity timeline, and role-gated action buttons wired to
  every relevant contract write (accept, cancel, submit evidence, resolve, finalize, contest,
  resolve_contest, and all three timeout/reclaim paths).
- `/promises/[id]/evidence` — evidence panel: URL inputs (add/remove), drag-and-drop file upload
  (→ backend → returns a URL → added to the list), note field, wallet-signed `submit_evidence`.
- `/promises/[id]/adjudication` — post-hoc adjudication explanation (evidence fetched → criteria
  compared → verdict/payout split) plus a genuine pending state while `resolve_promise` is
  in-flight. Deliberately not a fabricated step-by-step animation of validator internals, per the
  brief.
- `/profile/[address]` — reputation page, `get_reputation` fields shown as labeled "protocol
  facts" with the single derived metric (fulfillment rate) called out separately with its exact
  methodology, per WITNESSMARK.md section 23.
- `/wallet` — connected wallet info, balance, chain id, network/contract/backend configuration
  status, disconnect.
- Error/empty/loading states throughout (`components/ui.tsx`: `EmptyState`, `ErrorState`,
  `Spinner`), plus `app/error.tsx` and `app/not-found.tsx`. No page surfaces a bare console error
  to the user.

## Branding

`components/Logo.tsx` + `app/icon.svg` / `app/apple-icon.svg`: a wax-seal/notarization mark — a
navy circle, a dashed inner ring (ledger/verification motif), and a checkmark cut through it in
the surface color. Renders crisply from 16px favicon size up to the nav header. Next.js's
file-convention icons (`app/icon.svg`, `app/apple-icon.svg`) wire it up as favicon and
apple-touch-icon automatically; no separate script/build step needed since SVG favicons are
supported directly.

## Stack wiring

- **Wallet**: `@reown/appkit` + `@reown/appkit-adapter-wagmi` + `wagmi` + `viem`. The AppKit modal
  instance is constructed imperatively in `lib/appkit.ts`, guarded by a `typeof window` check,
  and exposed as `appKitModal` rather than used via the `useAppKit()` hook — that hook throws if
  called before `createAppKit()` has run, which happens on every SSR pass of a client component
  that imports it. Building the modal once, client-side only, and calling `.open()`/`.close()`
  directly avoids that without disabling SSR for the whole app.
- **Contract**: `genlayer-js`. `lib/genlayer.ts` wraps every read/write method from
  `contracts/witnessmark_contract.py` under its exact name — no invented methods. Reads go
  through React Query (`hooks/usePromiseData.ts`); writes go through `hooks/useContractTx.ts`,
  which drives a `pending → confirming → confirmed/failed` state machine shown via
  `components/TxStatus.tsx` on every write action.
- **Backend**: `lib/api.ts`; see `INTEGRATION_NOTES.md` for the real, reconciled endpoint shapes.
  **Wallet-auth (connect → nonce → signature → backend session) is implemented** —
  `hooks/useAuth.ts` — and used by the evidence-upload flow, which prompts the one extra
  (gasless) signature it needs automatically.
- **Time/attempt-gated action availability**: `lib/actions.ts`'s `getAvailableActions` derives
  every contract-gated action (evidence-reclaim timeout, force-refund, contest, finalize) from
  the same live `get_config()` values the contract itself checks (grace periods, contest window,
  resolve-attempt exhaustion), with fallback constants only for when config hasn't loaded yet —
  see `frontend/tests/actions.test.ts` for the regression coverage on this.

## Known gaps / follow-ups

- `/promises` and `/dashboard` currently read live from the contract via
  `get_party_promise_ids` + N `get_promise` calls (client-side `useQueries` fan-out). This is
  correct but not the fastest under GenLayer StudioNet's 30 req/min cap for a wallet with many
  promises — swapping in the backend's cached `/api/promises` list endpoint would help.
- Test coverage: **`docs/testing.md` is the single authoritative source for current test status**
  across contract/backend/frontend/E2E — deliberately not restated here, since restating exact
  counts and coverage claims in multiple files is what caused this file to go stale in the past
  (it previously claimed no Playwright coverage existed well after it had been added). Check
  `docs/testing.md` directly rather than trusting a summary here.
