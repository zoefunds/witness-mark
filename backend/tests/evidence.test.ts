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
  // cached() calls through to the fetcher directly, so tests exercise the
  // same code path as production without needing a real Redis instance.
  cached: vi.fn(async (_key: string, _ttl: number, fetcher: () => unknown) => fetcher()),
  invalidate: vi.fn(),
}));
vi.mock("../src/lib/genlayer.js", () => ({
  genlayerReads: { getPromise: (...args: unknown[]) => getPromiseMock(...args) },
  CONTRACT_ADDRESS: "0x0000000000000000000000000000000000000000",
}));

const { app } = await import("../src/app.js");
const { SESSION_COOKIE_NAME } = await import("../src/lib/auth.js");

const COUNTERPARTY = "0x1111111111111111111111111111111111111e";
const SOMEONE_ELSE = "0x2222222222222222222222222222222222222e";

function sessionCookieFor(address: string) {
  const token = jwt.sign({ address }, process.env.SESSION_JWT_SECRET!, { expiresIn: 3600 });
  return `${SESSION_COOKIE_NAME}=${token}`;
}

describe("POST /api/evidence/upload", () => {
  it("requires authentication", async () => {
    const res = await request(app).post("/api/evidence/upload").field("promiseId", "1");
    expect(res.status).toBe(401);
  });

  it("requires a valid promiseId", async () => {
    const res = await request(app)
      .post("/api/evidence/upload")
      .set("Cookie", sessionCookieFor(COUNTERPARTY))
      .field("promiseId", "not-a-number")
      .attach("files", Buffer.from("hello"), "hello.txt");
    expect(res.status).toBe(400);
  });

  it("requires at least one file", async () => {
    const res = await request(app)
      .post("/api/evidence/upload")
      .set("Cookie", sessionCookieFor(COUNTERPARTY))
      .field("promiseId", "1");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no files provided/);
  });

  it("rejects an authenticated wallet that is NOT the promise's on-chain counterparty (403)", async () => {
    getPromiseMock.mockResolvedValueOnce({
      counterparty: COUNTERPARTY,
      status: "ACCEPTED",
    });
    const res = await request(app)
      .post("/api/evidence/upload")
      .set("Cookie", sessionCookieFor(SOMEONE_ELSE))
      .field("promiseId", "1")
      .attach("files", Buffer.from("hello"), "hello.txt");
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/only the promise's counterparty/);
  });

  it("rejects upload when the promise is not in an evidence-accepting status (409)", async () => {
    getPromiseMock.mockResolvedValueOnce({
      counterparty: COUNTERPARTY,
      status: "FULFILLED",
    });
    const res = await request(app)
      .post("/api/evidence/upload")
      .set("Cookie", sessionCookieFor(COUNTERPARTY))
      .field("promiseId", "1")
      .attach("files", Buffer.from("hello"), "hello.txt");
    expect(res.status).toBe(409);
  });

  it("404s cleanly when the promise cannot be read from chain", async () => {
    getPromiseMock.mockRejectedValueOnce(new Error("promise 999 does not exist"));
    const res = await request(app)
      .post("/api/evidence/upload")
      .set("Cookie", sessionCookieFor(COUNTERPARTY))
      .field("promiseId", "999")
      .attach("files", Buffer.from("hello"), "hello.txt");
    expect(res.status).toBe(404);
  });
});
