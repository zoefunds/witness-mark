import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

const queryMock = vi.fn();

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
  genlayerReads: {},
  CONTRACT_ADDRESS: "0x0000000000000000000000000000000000000000",
}));

const { app } = await import("../src/app.js");
const { normalizeAddress, SESSION_COOKIE_NAME } = await import("../src/lib/auth.js");

beforeEach(() => {
  queryMock.mockReset();
});

describe("normalizeAddress", () => {
  it("lowercases and trims", () => {
    expect(normalizeAddress("  0xABCDEF0000000000000000000000000000ABCD  ")).toBe(
      "0xabcdef0000000000000000000000000000abcd",
    );
  });
});

describe("POST /api/auth/nonce", () => {
  it("rejects a missing address with 400", async () => {
    const res = await request(app).post("/api/auth/nonce").send({});
    expect(res.status).toBe(400);
  });

  it("rejects a malformed (non-hex-address) input with a 400 from issueNonce's own validation", async () => {
    const res = await request(app).post("/api/auth/nonce").send({ address: "not-an-address" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid wallet address/);
  });

  it("issues a single-use nonce embedded in a signable message for a valid address", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] }); // the upsert
    const address = "0x1234567890123456789012345678901234567890";
    const res = await request(app).post("/api/auth/nonce").send({ address });
    expect(res.status).toBe(200);
    expect(res.body.message).toContain(address);
    expect(res.body.message).toMatch(/Nonce: [0-9a-f]{32}/);
    expect(res.body.expiresAt).toBeTruthy();
  });
});

describe("POST /api/auth/verify", () => {
  it("rejects a request missing signature", async () => {
    const res = await request(app)
      .post("/api/auth/verify")
      .send({ address: "0x1234567890123456789012345678901234567890" });
    expect(res.status).toBe(400);
  });

  it("rejects when no nonce was ever issued for this address", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] }); // no pending nonce found
    const res = await request(app)
      .post("/api/auth/verify")
      .send({ address: "0x1234567890123456789012345678901234567890", signature: "0xdead" });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/no pending nonce/);
  });
});

describe("GET /api/auth/session (requireAuth middleware)", () => {
  it("returns 401 with no session cookie", async () => {
    const res = await request(app).get("/api/auth/session");
    expect(res.status).toBe(401);
  });

  it("returns 401 for a garbage/forged cookie value", async () => {
    const res = await request(app).get("/api/auth/session").set("Cookie", `${SESSION_COOKIE_NAME}=not-a-real-jwt`);
    expect(res.status).toBe(401);
  });

  it("returns the session address for a validly-signed token", async () => {
    const token = jwt.sign({ address: "0xabc0000000000000000000000000000000abc0" }, process.env.SESSION_JWT_SECRET!, {
      expiresIn: 3600,
    });
    queryMock.mockResolvedValueOnce({ rows: [{ address: "0xabc0000000000000000000000000000000abc0" }] });
    const res = await request(app).get("/api/auth/session").set("Cookie", `${SESSION_COOKIE_NAME}=${token}`);
    expect(res.status).toBe(200);
    expect(res.body.address).toBe("0xabc0000000000000000000000000000000abc0");
  });
});
