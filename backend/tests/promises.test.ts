import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

const getPromiseMock = vi.fn();
const queryMock = vi.fn().mockResolvedValue({ rows: [] });

vi.mock("../src/db/pool.js", () => ({
  pool: { query: (...args: unknown[]) => queryMock(...args) },
  withTransaction: vi.fn(),
}));
vi.mock("../src/lib/redis.js", () => ({
  redis: { ping: vi.fn().mockResolvedValue("PONG") },
  cached: vi.fn(async (_key: string, _ttl: number, fetcher: () => unknown) => fetcher()),
  invalidate: vi.fn(),
}));
vi.mock("../src/lib/genlayer.js", () => ({
  genlayerReads: {
    getPromise: (...args: unknown[]) => getPromiseMock(...args),
    getActivity: vi.fn(),
  },
  CONTRACT_ADDRESS: "0x0000000000000000000000000000000000000000",
}));

const { app } = await import("../src/app.js");
const { SESSION_COOKIE_NAME } = await import("../src/lib/auth.js");

const CREATOR = "0x1111111111111111111111111111111111111e";
const COUNTERPARTY = "0x2222222222222222222222222222222222222e";
const STRANGER = "0x3333333333333333333333333333333333333e";

function sessionCookieFor(address: string) {
  const token = jwt.sign({ address }, process.env.SESSION_JWT_SECRET!, { expiresIn: 3600 });
  return `${SESSION_COOKIE_NAME}=${token}`;
}

describe("GET /api/promises/:id", () => {
  it("rejects a non-numeric id", async () => {
    const res = await request(app).get("/api/promises/not-a-number");
    expect(res.status).toBe(400);
  });

  it("proxies a real get_promise() read", async () => {
    getPromiseMock.mockResolvedValueOnce({ id: 1, status: "CREATED" });
    const res = await request(app).get("/api/promises/1");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("CREATED");
  });
});

describe("POST /api/promises/:id/sync", () => {
  it("requires authentication", async () => {
    const res = await request(app).post("/api/promises/1/sync");
    expect(res.status).toBe(401);
  });

  it("rejects a caller who is neither creator nor counterparty ON-CHAIN, even if they claim to be", async () => {
    // Regression test for the fix: the endpoint must derive party identity
    // from a live get_promise() read, never trust a client-supplied body.
    getPromiseMock.mockResolvedValueOnce({
      creator: CREATOR,
      counterparty: COUNTERPARTY,
      title: "T",
      category: "goods",
      status: "CREATED",
      stake_wei: "1000",
      created_ts: 1700000000,
    });
    const res = await request(app)
      .post("/api/promises/1/sync")
      .set("Cookie", sessionCookieFor(STRANGER))
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/not a party to this promise on-chain/);
  });

  it("syncs using chain-derived values for a genuine party", async () => {
    getPromiseMock.mockResolvedValueOnce({
      creator: CREATOR,
      counterparty: COUNTERPARTY,
      title: "Real title from chain",
      category: "goods",
      status: "ACCEPTED",
      stake_wei: "5000000000000000000",
      created_ts: 1700000000,
    });
    const res = await request(app)
      .post("/api/promises/1/sync")
      .set("Cookie", sessionCookieFor(COUNTERPARTY))
      .send({ title: "attacker-supplied title", stakeWei: "999999999999999999999999" });
    expect(res.status).toBe(200);
    expect(res.body.promise.title).toBe("Real title from chain");
    // The INSERT query's parameters must reflect the chain values, not
    // the attacker-supplied ones in the request body.
    const insertCall = queryMock.mock.calls.find(([sql]: [string]) => sql.includes("INSERT INTO promise_index"));
    expect(insertCall).toBeTruthy();
    const params = insertCall![1];
    expect(params).toContain("Real title from chain");
    expect(params).not.toContain("attacker-supplied title");
  });
});
