import { describe, it, expect, vi } from "vitest";
import request from "supertest";

vi.mock("../src/db/pool.js", () => ({
  pool: { query: vi.fn().mockResolvedValue({ rows: [] }) },
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

describe("health endpoints", () => {
  it("GET /healthz always returns 200 with uptime, independent of DB/Redis", async () => {
    const res = await request(app).get("/healthz");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.uptime).toBe("number");
  });

  it("GET /readyz returns 200 when DB and Redis both respond", async () => {
    const res = await request(app).get("/readyz");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("GET /unknown-route returns a clean 404 JSON, never a bare error", async () => {
    const res = await request(app).get("/unknown-route");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "not found" });
  });
});

describe("readyz failure handling", () => {
  it("returns 503 (not a crash) when the database is unreachable", async () => {
    vi.resetModules();
    vi.doMock("../src/db/pool.js", () => ({
      pool: { query: vi.fn().mockRejectedValue(new Error("connection refused")) },
      withTransaction: vi.fn(),
    }));
    vi.doMock("../src/lib/redis.js", () => ({
      redis: { ping: vi.fn().mockResolvedValue("PONG") },
      cached: vi.fn(async (_key: string, _ttl: number, fetcher: () => unknown) => fetcher()),
      invalidate: vi.fn(),
    }));
    vi.doMock("../src/lib/genlayer.js", () => ({
      genlayerReads: {},
      CONTRACT_ADDRESS: "0x0000000000000000000000000000000000000000",
    }));
    const { app: appWithBadDb } = await import("../src/app.js");
    const res = await request(appWithBadDb).get("/readyz");
    expect(res.status).toBe(503);
    expect(res.body.ok).toBe(false);
  });
});
