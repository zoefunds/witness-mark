import { Router } from "express";
import { z } from "zod";
import {
  issueNonce,
  verifySignatureAndIssueSession,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_MAX_AGE_MS,
  normalizeAddress,
} from "../lib/auth.js";
import { env } from "../lib/env.js";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth.js";
import { pool } from "../db/pool.js";

export const authRouter = Router();

const NonceRequestSchema = z.object({ address: z.string().min(1) });
const VerifyRequestSchema = z.object({ address: z.string().min(1), signature: z.string().min(1) });

authRouter.post("/nonce", async (req, res) => {
  const parsed = NonceRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "address is required" });
  }
  try {
    const { message, expiresAt } = await issueNonce(parsed.data.address);
    res.json({ message, expiresAt });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

authRouter.post("/verify", async (req, res) => {
  const parsed = VerifyRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "address and signature are required" });
  }
  try {
    const { token, address } = await verifySignatureAndIssueSession(parsed.data.address, parsed.data.signature);
    // The frontend (witness-mark.vercel.app) and this API (witnessmark-
    // api.fly.dev) are different registrable domains, so this is a
    // cross-site request from the browser's perspective. A `lax` cookie
    // is NOT sent on cross-site fetch/XHR (only on top-level navigation),
    // which would make every authenticated request after sign-in silently
    // look logged-out. `none` (paired with `secure`, required together by
    // browsers) is what actually works for a separate API origin; in
    // local dev (NODE_ENV !== "production", http://localhost) `secure`
    // cookies aren't sent over plain HTTP, so lax+non-secure is used
    // there instead.
    res.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: SESSION_COOKIE_MAX_AGE_MS,
    });
    res.json({ address });
  } catch (err) {
    res.status(401).json({ error: (err as Error).message });
  }
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? "none" : "lax",
  });
  res.json({ ok: true });
});

authRouter.get("/session", requireAuth, async (req: AuthedRequest, res) => {
  const address = normalizeAddress(req.address!);
  const { rows } = await pool.query(
    `SELECT address, display_name, twitter_handle, twitter_verified, created_at FROM users WHERE address = $1`,
    [address],
  );
  res.json({ address, user: rows[0] ?? { address } });
});
