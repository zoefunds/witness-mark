import { describe, it, expect, vi, beforeAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import pg from "pg";

const getPromiseMock = vi.fn();

// Real Postgres below the route layer; the one thing still mocked is the
// chain read itself (see the sibling auth-flow suite's comment for why:
// this is a Postgres/Redis integration suite, not a StudioNet one --
// that's what tests/integration/test_witnessmark_lifecycle.py at the
// repo root is for).
vi.mock("../../src/lib/genlayer.js", () => ({
  genlayerReads: { getPromise: (...args: unknown[]) => getPromiseMock(...args) },
  CONTRACT_ADDRESS: "0x0000000000000000000000000000000000000000",
}));

let app: import("express").Express;
let SESSION_COOKIE_NAME: string;
let pool: pg.Pool;

const CREATOR = "0x1111111111111111111111111111111111111e";
const COUNTERPARTY = "0x2222222222222222222222222222222222222e";

function sessionCookieFor(address: string) {
  const token = jwt.sign({ address }, process.env.SESSION_JWT_SECRET!, { expiresIn: 3600 });
  return `${SESSION_COOKIE_NAME}=${token}`;
}

beforeAll(async () => {
  ({ app } = await import("../../src/app.js"));
  ({ SESSION_COOKIE_NAME } = await import("../../src/lib/auth.js"));
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
});

describe("POST /api/promises/:id/sync against a real promise_index table", () => {
  it("writes a real row derived from the (mocked) chain read, readable back via a direct SQL query", async () => {
    getPromiseMock.mockResolvedValueOnce({
      creator: CREATOR,
      counterparty: COUNTERPARTY,
      title: "Real DB-backed procurement promise",
      category: "procurement",
      status: "ACCEPTED",
      stake_wei: "7000000000000000000",
      created_ts: 1_800_000_000,
    });

    const res = await request(app)
      .post("/api/promises/42/sync")
      .set("Cookie", sessionCookieFor(CREATOR))
      .send({});
    expect(res.status).toBe(200);

    const { rows } = await pool.query("SELECT * FROM promise_index WHERE promise_id = $1", [42]);
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Real DB-backed procurement promise");
    expect(rows[0].creator_address).toBe(CREATOR.toLowerCase());
    expect(rows[0].counterparty_address).toBe(COUNTERPARTY.toLowerCase());
    expect(rows[0].stake_wei).toBe("7000000000000000000");
    expect(rows[0].last_known_status).toBe("ACCEPTED");
  });

  it("a second sync UPDATEs the same real row rather than inserting a duplicate", async () => {
    getPromiseMock.mockResolvedValueOnce({
      creator: CREATOR,
      counterparty: COUNTERPARTY,
      title: "Original title",
      category: "procurement",
      status: "ACCEPTED",
      stake_wei: "1000000000000000000",
      created_ts: 1_800_000_100,
    });
    await request(app).post("/api/promises/99/sync").set("Cookie", sessionCookieFor(CREATOR)).send({});

    getPromiseMock.mockResolvedValueOnce({
      creator: CREATOR,
      counterparty: COUNTERPARTY,
      title: "Original title",
      category: "procurement",
      status: "FULFILLED",
      stake_wei: "1000000000000000000",
      created_ts: 1_800_000_100,
    });
    await request(app).post("/api/promises/99/sync").set("Cookie", sessionCookieFor(CREATOR)).send({});

    const { rows } = await pool.query("SELECT * FROM promise_index WHERE promise_id = $1", [99]);
    expect(rows).toHaveLength(1);
    expect(rows[0].last_known_status).toBe("FULFILLED");
  });

  it("GET /api/promises lists the real row back for the creator via role/address filters", async () => {
    getPromiseMock.mockResolvedValueOnce({
      creator: CREATOR,
      counterparty: COUNTERPARTY,
      title: "Listed promise",
      category: "procurement",
      status: "CREATED",
      stake_wei: "2000000000000000000",
      created_ts: 1_800_000_200,
    });
    await request(app).post("/api/promises/7/sync").set("Cookie", sessionCookieFor(CREATOR)).send({});

    const res = await request(app).get(`/api/promises?role=creator&address=${CREATOR}`);
    expect(res.status).toBe(200);
    expect(res.body.some((row: { promise_id: number }) => row.promise_id === 7)).toBe(true);
  });

  it("rejects a caller who is not a party to the promise ON-CHAIN, verified against a real DB (no row written)", async () => {
    const stranger = "0x3333333333333333333333333333333333333e";
    getPromiseMock.mockResolvedValueOnce({
      creator: CREATOR,
      counterparty: COUNTERPARTY,
      title: "Should not be synced by a stranger",
      category: "procurement",
      status: "CREATED",
      stake_wei: "1000000000000000000",
      created_ts: 1_800_000_300,
    });

    const res = await request(app)
      .post("/api/promises/13/sync")
      .set("Cookie", sessionCookieFor(stranger))
      .send({});
    expect(res.status).toBe(403);

    const { rows } = await pool.query("SELECT * FROM promise_index WHERE promise_id = $1", [13]);
    expect(rows).toHaveLength(0);
  });
});
