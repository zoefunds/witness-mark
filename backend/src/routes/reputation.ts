import { Router } from "express";
import { cached } from "../lib/redis.js";
import { genlayerReads } from "../lib/genlayer.js";
import { normalizeAddress } from "../lib/auth.js";

export const reputationRouter = Router();

// Reputation and platform stats change slowly relative to an individual
// promise's lifecycle, so these get a longer TTL -- fewer StudioNet reads
// for data that rarely needs to be second-fresh.
const REPUTATION_TTL_SECONDS = 60;
const STATS_TTL_SECONDS = 120;
const CONFIG_TTL_SECONDS = 3600; // protocol constants, effectively static

reputationRouter.get("/:address", async (req, res) => {
  const address = normalizeAddress(req.params.address);
  if (!/^0x[0-9a-f]{40}$/.test(address)) {
    return res.status(400).json({ error: "invalid address" });
  }
  try {
    const reputation = await cached(`reputation:${address}`, REPUTATION_TTL_SECONDS, () =>
      genlayerReads.getReputation(address),
    );
    res.json(reputation);
  } catch (err) {
    res.status(502).json({ error: "failed to read reputation", detail: (err as Error).message });
  }
});

export const statsRouter = Router();

statsRouter.get("/", async (_req, res) => {
  try {
    const stats = await cached("platform:stats", STATS_TTL_SECONDS, () => genlayerReads.getPlatformStats());
    res.json(stats);
  } catch (err) {
    res.status(502).json({ error: "failed to read platform stats", detail: (err as Error).message });
  }
});

statsRouter.get("/config", async (_req, res) => {
  try {
    const config = await cached("contract:config", CONFIG_TTL_SECONDS, () => genlayerReads.getConfig());
    res.json(config);
  } catch (err) {
    res.status(502).json({ error: "failed to read contract config", detail: (err as Error).message });
  }
});
