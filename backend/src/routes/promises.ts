import { Router } from "express";
import { cached, invalidate } from "../lib/redis.js";
import { genlayerReads } from "../lib/genlayer.js";
import { pool } from "../db/pool.js";
import { normalizeAddress } from "../lib/auth.js";
import { requireAuth, optionalAuth, type AuthedRequest } from "../middleware/requireAuth.js";

export const promisesRouter = Router();

// Short TTLs: this data changes whenever someone transacts, but a 20s
// staleness window is invisible to users and keeps this comfortably under
// GenLayer StudioNet's 30 requests/minute read limit even under load.
const PROMISE_TTL_SECONDS = 20;
const LIST_TTL_SECONDS = 15;

promisesRouter.get("/:id", async (req, res) => {
  const promiseId = Number(req.params.id);
  if (!Number.isInteger(promiseId) || promiseId < 0) {
    return res.status(400).json({ error: "invalid promise id" });
  }
  try {
    const promise = await cached(`promise:${promiseId}`, PROMISE_TTL_SECONDS, () =>
      genlayerReads.getPromise(promiseId),
    );
    res.json(promise);
  } catch (err) {
    res.status(404).json({ error: "promise not found or unreachable", detail: (err as Error).message });
  }
});

promisesRouter.get("/:id/activity", async (req, res) => {
  const promiseId = Number(req.params.id);
  const offset = Number(req.query.offset ?? 0);
  const limit = Number(req.query.limit ?? 25);
  if (!Number.isInteger(promiseId) || promiseId < 0) {
    return res.status(400).json({ error: "invalid promise id" });
  }
  try {
    const activity = await cached(`promise:${promiseId}:activity:${offset}:${limit}`, PROMISE_TTL_SECONDS, () =>
      genlayerReads.getActivity(promiseId, offset, limit),
    );
    res.json(activity);
  } catch (err) {
    res.status(404).json({ error: "activity not found or unreachable", detail: (err as Error).message });
  }
});

// Fast "my promises" listing backed by the local index, not a live chain
// scan. The index is advisory -- /sync (below) is what keeps it honest.
promisesRouter.get("/", optionalAuth, async (req: AuthedRequest, res) => {
  const role = String(req.query.role ?? "any"); // creator | counterparty | any
  const status = req.query.status ? String(req.query.status) : undefined;
  const address = req.query.address ? normalizeAddress(String(req.query.address)) : req.address;

  if (!address) {
    return res.status(400).json({ error: "address query param or an authenticated session is required" });
  }

  const roleClause =
    role === "creator"
      ? "creator_address = $1"
      : role === "counterparty"
        ? "counterparty_address = $1"
        : "(creator_address = $1 OR counterparty_address = $1)";
  const statusClause = status ? "AND last_known_status = $2" : "";
  const params = status ? [address, status] : [address];

  try {
    const { rows } = await cached(
      `promise_index:${address}:${role}:${status ?? "all"}`,
      LIST_TTL_SECONDS,
      async () => {
        const result = await pool.query(
          `SELECT promise_id, creator_address, counterparty_address, title, category,
                  last_known_status, stake_wei, created_ts
           FROM promise_index
           WHERE ${roleClause} ${statusClause}
           ORDER BY created_ts DESC
           LIMIT 200`,
          params,
        );
        return result;
      },
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "failed to list promises", detail: (err as Error).message });
  }
});

/**
 * Called by the frontend right after it confirms a create/accept/resolve/
 * finalize transaction, so the local "my promises" index reflects reality
 * without this backend having to run its own chain-polling indexer.
 *
 * SECURITY: the index is populated ONLY from a fresh, direct
 * get_promise() read against the deployed contract -- never from
 * client-supplied fields. Earlier versions of this endpoint trusted the
 * request body's creator/counterparty/title/status/stake directly (only
 * checking that the CALLER matched one of the caller-asserted addresses,
 * which is circular and lets any authenticated wallet write arbitrary
 * garbage into another promise's dashboard/reputation-adjacent index row).
 * This cannot move funds -- the contract remains the sole financial
 * source of truth -- but a poisoned index still corrupts what users see
 * on their dashboard, so it is closed here rather than left as a known
 * gap: the request body is now just "which promise id to resync", and
 * every stored value is read straight from the chain.
 */
promisesRouter.post("/:id/sync", requireAuth, async (req: AuthedRequest, res) => {
  const promiseId = Number(req.params.id);
  if (!Number.isInteger(promiseId) || promiseId < 0) {
    return res.status(400).json({ error: "invalid promise id" });
  }

  const caller = normalizeAddress(req.address!);

  try {
    const chainPromise = await genlayerReads.getPromise(promiseId);
    const creatorAddr = normalizeAddress(chainPromise.creator);
    const counterpartyAddr = normalizeAddress(chainPromise.counterparty);

    if (caller !== creatorAddr && caller !== counterpartyAddr) {
      return res.status(403).json({ error: "you are not a party to this promise on-chain" });
    }

    await pool.query(
      `INSERT INTO promise_index (promise_id, creator_address, counterparty_address, title, category, last_known_status, stake_wei, created_ts)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (promise_id) DO UPDATE SET
         creator_address = EXCLUDED.creator_address,
         counterparty_address = EXCLUDED.counterparty_address,
         title = EXCLUDED.title,
         category = EXCLUDED.category,
         last_known_status = EXCLUDED.last_known_status,
         stake_wei = EXCLUDED.stake_wei,
         synced_at = now()`,
      [
        promiseId,
        creatorAddr,
        counterpartyAddr,
        chainPromise.title,
        chainPromise.category,
        chainPromise.status,
        String(chainPromise.stake_wei),
        chainPromise.created_ts,
      ],
    );
    await invalidate(`promise:${promiseId}`);
    res.json({ ok: true, promise: chainPromise });
  } catch (err) {
    res.status(500).json({ error: "sync failed", detail: (err as Error).message });
  }
});
