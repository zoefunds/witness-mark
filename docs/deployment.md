# WitnessMark — Deployment

## Contract (GenLayer StudioNet)

The contract is deployed by the project owner, never by an assistant/CI
process, per project policy. To redeploy after a contract change:

```bash
cd /Users/macbook/witnessmark
genvm-lint check contracts/witnessmark_contract.py --json   # must pass clean first
genlayer deploy --contract contracts/witnessmark_contract.py
```

After deploying, update:
- `backend/.env` and the Fly secret `GENLAYER_CONTRACT_ADDRESS`
  (`fly secrets set -a witnessmark-api GENLAYER_CONTRACT_ADDRESS=0x...`)
- `frontend/.env.local` and the Vercel env var `NEXT_PUBLIC_CONTRACT_ADDRESS`
- `MEMORY.md`'s "Deployed contract" section

## Backend (Fly.io)

App: `witnessmark-api`. Config: `backend/fly.toml` (24/7:
`min_machines_running=1`, `auto_stop_machines=false`, always-restart).

```bash
cd backend
fly deploy
# after schema changes:
fly ssh console -a witnessmark-api -C "node dist/db/migrate.js"
```

Secrets are managed via `fly secrets set -a witnessmark-api KEY=value`
(never committed). See `backend/.env.example` for the full list.

## Frontend (Vercel)

Project: `witness-mark` (scope `adebiyi2002gmailcoms-projects`), live at
`https://witness-mark.vercel.app`.

```bash
cd frontend
vercel deploy --prod --yes --scope adebiyi2002gmailcoms-projects
```

Env vars are set via `vercel env add <NAME> production --scope
adebiyi2002gmailcoms-projects` (background these calls with a ~15s
kill-guard — they have been observed to hang past that on this machine
for reasons unclear; see `MEMORY.md`).

## Post-deploy verification checklist

```bash
curl -s https://witnessmark-api.fly.dev/healthz
curl -s https://witnessmark-api.fly.dev/readyz
curl -s https://witnessmark-api.fly.dev/api/stats   # should proxy a real StudioNet read
curl -s -o /dev/null -w "%{http_code}\n" https://witness-mark.vercel.app
```
