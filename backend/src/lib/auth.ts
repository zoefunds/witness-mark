import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { verifyMessage } from "viem";
import { env } from "./env.js";
import { pool } from "../db/pool.js";

const NONCE_TTL_MINUTES = 5;
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}

/**
 * Wallet authentication, connect -> nonce/challenge -> signature ->
 * backend verification -> authenticated session, per WITNESSMARK.md
 * section 15. A wallet address alone is never treated as sufficient
 * authentication -- the caller must prove control of the private key by
 * signing a fresh, single-use, backend-issued nonce.
 */
export async function issueNonce(rawAddress: string): Promise<{ nonce: string; message: string; expiresAt: Date }> {
  const address = normalizeAddress(rawAddress);
  if (!/^0x[0-9a-f]{40}$/.test(address)) {
    throw new Error("invalid wallet address");
  }

  const nonce = crypto.randomBytes(16).toString("hex");
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + NONCE_TTL_MINUTES * 60_000);

  await pool.query(
    `INSERT INTO auth_nonces (address, nonce, issued_at, expires_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (address) DO UPDATE SET nonce = $2, issued_at = $3, expires_at = $4`,
    [address, nonce, issuedAt, expiresAt],
  );

  const message = buildSignMessage(address, nonce, issuedAt);
  return { nonce, message, expiresAt };
}

function buildSignMessage(address: string, nonce: string, issuedAt: Date): string {
  return [
    "WitnessMark wants you to sign in with your wallet.",
    "",
    `Address: ${address}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt.toISOString()}`,
    "",
    "This signature will not trigger a blockchain transaction or cost any gas.",
  ].join("\n");
}

export async function verifySignatureAndIssueSession(
  rawAddress: string,
  signature: string,
): Promise<{ token: string; address: string }> {
  const address = normalizeAddress(rawAddress);

  const { rows } = await pool.query<{ nonce: string; issued_at: Date; expires_at: Date }>(
    `SELECT nonce, issued_at, expires_at FROM auth_nonces WHERE address = $1`,
    [address],
  );
  const record = rows[0];
  if (!record) {
    throw new Error("no pending nonce for this address; request a new one");
  }
  if (record.expires_at.getTime() < Date.now()) {
    await pool.query(`DELETE FROM auth_nonces WHERE address = $1`, [address]);
    throw new Error("nonce expired; request a new one");
  }

  const message = buildSignMessage(address, record.nonce, record.issued_at);
  const valid = await verifyMessage({
    address: address as `0x${string}`,
    message,
    signature: signature as `0x${string}`,
  });
  if (!valid) {
    throw new Error("signature verification failed");
  }

  // Single-use: the nonce is consumed immediately so the same signature
  // can never be replayed to mint a second session.
  await pool.query(`DELETE FROM auth_nonces WHERE address = $1`, [address]);

  await pool.query(
    `INSERT INTO users (address, last_login_at) VALUES ($1, now())
     ON CONFLICT (address) DO UPDATE SET last_login_at = now()`,
    [address],
  );

  const token = jwt.sign({ address }, env.SESSION_JWT_SECRET, { expiresIn: SESSION_TTL_SECONDS });
  return { token, address };
}

export function verifySessionToken(token: string): { address: string } | null {
  try {
    const payload = jwt.verify(token, env.SESSION_JWT_SECRET) as { address: string };
    return { address: payload.address };
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_NAME = "witnessmark_session";
export const SESSION_COOKIE_MAX_AGE_MS = SESSION_TTL_SECONDS * 1000;
