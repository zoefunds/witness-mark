import pg from "pg";
import { env } from "../lib/env.js";

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: env.DATABASE_URL.includes("sslmode=disable") ? false : { rejectUnauthorized: false },
});

pool.on("error", (err) => {
  // A background idle-client error must never crash the whole process --
  // this backend has to stay up 24/7 (see fly.toml).
  console.error("[pg] unexpected pool error:", err.message);
});

export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
