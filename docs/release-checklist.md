# WitnessMark — Release Checklist

Use this before any deployment that will hold meaningful, uncapped real
value (a StudioNet demo or capped-stake beta does not need every box
checked — see `docs/security.md` for what's already covered).

## Contract

- [ ] `genvm-lint check contracts/witnessmark_contract.py --json` passes clean.
- [ ] Fast `gltest` subset passes live (`gltest tests/integration/test_witnessmark_lifecycle.py -v -m "not slow"`).
- [ ] Slow `gltest` subset run at least once recently (adversarial evidence, empirical convergence, contest round — see `docs/testing.md`).
- [ ] **Formal third-party security audit completed** — still outstanding as of this writing; required before uncapped real value.
- [ ] Deployed by the project owner (never by an automated agent), address recorded in `MEMORY.md`.
- [ ] New address wired into `backend/.env` (`GENLAYER_CONTRACT_ADDRESS`, as a Fly secret) and `frontend/.env.local` (`NEXT_PUBLIC_CONTRACT_ADDRESS`, as a Vercel env var).

## Backend

- [ ] `npm run typecheck && npm run test && npm run build` all pass.
- [ ] `fly deploy` completes; `/healthz` and `/readyz` both return 200 post-deploy.
- [ ] `fly.toml`'s `min_machines_running = 1` / `auto_stop_machines = false` still set (24/7 requirement).
- [ ] Secrets rotated if this release follows any credential exposure.

## Frontend

- [ ] `npm run lint && npm run test && npm run build` all pass.
- [ ] `vercel deploy --prod` completes; the live URL returns 200 on `/` and a sample `/promises/[id]`.
- [ ] Env vars match the current contract address / API URL.

## Cross-cutting

- [ ] CORS (`CORS_ORIGIN` on the backend) matches the actual frontend origin.
- [ ] `MEMORY.md` updated with what changed and why.
- [ ] `docs/security.md` and `docs/testing.md` checked for staleness against what actually changed this release (a recurring finding in past reviews — see `MEMORY.md`'s external-review rounds).

## Not yet part of this checklist (fast-follows)

- Browser end-to-end tests (Playwright/Cypress) covering the full
  create → accept → submit evidence → resolve → contest/finalize journey
  against a live testnet, with published transaction links.
- Mobile QA pass.
- A demo video.
