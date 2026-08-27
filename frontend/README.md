# WitnessMark — Frontend

Next.js 16 (App Router, Turbopack) + TypeScript + Tailwind CSS v4
frontend for [WitnessMark](../README.md), live at
**https://witness-mark.vercel.app**.

See `FRONTEND_STATUS.md` for a full build summary and `INTEGRATION_NOTES.md`
for the exact backend API contract this app talks to. See the repo root
`README.md` for the whole-project overview (contract, backend, deployment).

## Run locally

```bash
npm install
cp .env.local.example .env.local   # then fill in real values, see below
npm run dev
```

Open http://localhost:3000.

## Environment variables (`.env.local`)

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_REOWN_PROJECT_ID` | Reown (WalletConnect) AppKit project ID — wallet connect UI |
| `NEXT_PUBLIC_API_URL` | WitnessMark backend base URL |
| `NEXT_PUBLIC_GENLAYER_CHAIN_ID` | GenLayer chain id (StudioNet: `61999`) |
| `NEXT_PUBLIC_GENLAYER_RPC_URL` | GenLayer RPC URL (StudioNet: `https://studio.genlayer.com/api`) |
| `NEXT_PUBLIC_CONTRACT_ADDRESS` | Deployed WitnessMark contract address |

All are safe to expose client-side (no secrets here — see `backend/` for
where actual secrets live). If `NEXT_PUBLIC_CONTRACT_ADDRESS` is unset,
the app shows a "contract not configured" banner and empty states instead
of crashing.

## Scripts

```bash
npm run dev      # dev server
npm run build    # production build
npm run lint     # eslint
npm run test     # vitest — pure-logic unit tests (lib/actions.ts, lib/format.ts)
```

## Structure

- `app/` — pages (App Router): landing, dashboard, promises list/detail/new,
  evidence submission, adjudication view, reputation profile, wallet/settings.
- `lib/genlayer.ts` — every contract read/write, named exactly after
  `contracts/witnessmark_contract.py`'s public methods.
- `lib/actions.ts` — client-side action-availability logic, deriving
  which contract writes are currently valid from the same time/attempt
  preconditions the contract itself enforces (see its own header comment).
- `lib/api.ts` — typed client for the WitnessMark backend.
- `hooks/useAuth.ts` — wallet-auth session flow (connect → nonce → sign → verify).
- `hooks/usePromiseData.ts`, `hooks/useContractTx.ts` — React Query reads,
  write-transaction state machine.
- `components/` — shared UI (cards, status badges, tx status, logo/favicon).
