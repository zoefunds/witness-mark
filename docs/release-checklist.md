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
- [ ] `node backend/scripts/verify-deployment.mjs` passes (source hash AND method inventory both match the deployed instance exactly) — update `docs/deployment-manifest.md` with the new hash/commit/address either way, noting any known drift explicitly if it doesn't yet pass.

## Backend

- [ ] `npm run typecheck && npm run test && npm run build` all pass.
- [ ] `fly deploy` completes; `/healthz` and `/readyz` both return 200 post-deploy.
- [ ] `fly.toml`'s `min_machines_running = 1` / `auto_stop_machines = false` still set (24/7 requirement).
- [ ] Secrets rotated if this release follows any credential exposure.

## Frontend

- [ ] `npm run lint && npm run test && npm run build` all pass.
- [ ] `vercel deploy --prod` completes; the live URL returns 200 on `/` and a sample `/promises/[id]`.
- [ ] Env vars match the current contract address / API URL.
- [ ] `npm run test:e2e` passes against the live deployed URL (both `desktop-chromium` and `mobile`/WebKit projects) — catches page-load regressions and nav-layer bugs (e.g. the mobile-menu bug found and fixed 2026-08-27) that unit tests can't see.

## Cross-cutting

- [ ] CORS (`CORS_ORIGIN` on the backend) matches the actual frontend origin.
- [ ] `MEMORY.md` updated with what changed and why.
- [ ] `docs/security.md` and `docs/testing.md` checked for staleness against what actually changed this release (a recurring finding in past reviews — see `MEMORY.md`'s external-review rounds).

## Not yet part of this checklist (fast-follows)

- A formal third-party contract audit — required before the protocol
  handles meaningful, uncapped real value; see `docs/security.md`'s
  "Known gaps" section.
- A "changed evidence" convergence sweep (evidence that shifts between
  resolve attempts, rather than a static fixture) — needs a controlled
  mutable evidence server, not yet built. The broader n=5 convergence
  study across BROKEN-leaning and compound/partial-condition evidence is
  already done; see `docs/testing.md`.
- A demo video.
