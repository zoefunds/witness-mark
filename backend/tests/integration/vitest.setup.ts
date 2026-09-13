import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";
import { Redis } from "ioredis";

// Points at the real ephemeral containers from docker-compose.test.yml
// (or CI's GitHub Actions `services:` block, which publishes the same
// ports) -- never the production DATABASE_URL/REDIS_URL, and this file
// intentionally does NOT fall back to reading backend/.env, so a
// misconfigured environment fails loudly instead of accidentally
// touching production data.
process.env.NODE_ENV = "test";
// sslmode=disable is required here (not just an option): src/db/pool.ts
// defaults to requiring SSL unless the connection string says otherwise,
// which is the correct secure default for production (Fly Postgres) but
// breaks against a plain local/CI test container with no SSL configured.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://postgres:test@localhost:5546/witnessmark_test?sslmode=disable";
process.env.REDIS_URL = process.env.TEST_REDIS_URL ?? "redis://localhost:6391";
process.env.GENLAYER_CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000000";
process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
process.env.CLOUDINARY_API_KEY = "test-key";
process.env.CLOUDINARY_API_SECRET = "test-secret";
process.env.SESSION_JWT_SECRET = "integration-test-session-secret-32-chars-min";
process.env.REOWN_PROJECT_ID = "test-project-id";
process.env.CORS_ORIGIN = "http://localhost:3000";
process.env.PORT = "0";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function waitForPostgres(pool: pg.Pool, attempts = 15) {
  for (let i = 0; i < attempts; i++) {
    try {
      await pool.query("SELECT 1");
      return;
    } catch (err) {
      if (i === attempts - 1) {
        throw new Error(
          `Could not reach test Postgres at ${process.env.DATABASE_URL} after ${attempts} attempts. ` +
            `Run \`docker compose -f docker-compose.test.yml up -d\` first. Original error: ${(err as Error).message}`,
        );
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
await waitForPostgres(pool);

// Apply the REAL production schema -- if this ever drifts from what the
// app actually needs, these tests fail immediately rather than the gap
// being discovered from mocked tests that never touch a real schema.
const schemaSql = readFileSync(path.join(__dirname, "../../src/db/schema.sql"), "utf-8");
await pool.query(schemaSql);

// Start every test file from clean tables -- these tests are the only
// thing writing to this database, so a full truncate is safe and keeps
// tests independent of each other and of prior runs.
await pool.query(
  "TRUNCATE auth_nonces, users, promise_index, evidence_files, audit_log RESTART IDENTITY CASCADE",
);

await pool.end();

// Same reasoning as the Postgres truncate above: start every run from a
// genuinely empty cache, not whatever a previous (possibly failed) run
// left behind under the same "integration:test:*" keys.
const redis = new Redis(process.env.REDIS_URL);
const staleKeys = await redis.keys("integration:test:*");
if (staleKeys.length > 0) await redis.del(...staleKeys);
redis.disconnect();
