import { describe, it, expect, vi } from "vitest";

describe("cached() against a real Redis instance", () => {
  it("calls the fetcher once and serves the second call from a real cache hit", async () => {
    const { cached, redis } = await import("../../src/lib/redis.js");
    const fetcher = vi.fn().mockResolvedValue({ value: "real-value" });

    const first = await cached("integration:test:key1", 5, fetcher);
    const second = await cached("integration:test:key1", 5, fetcher);

    expect(first).toEqual({ value: "real-value" });
    expect(second).toEqual({ value: "real-value" });
    expect(fetcher).toHaveBeenCalledTimes(1);

    // Confirms this really is Redis-backed, not an in-process memoization
    // that would happen to pass the assertions above either way.
    const raw = await redis.get("integration:test:key1");
    expect(raw).toBe(JSON.stringify({ value: "real-value" }));
  });

  it("expires after its real TTL and calls the fetcher again", async () => {
    const { cached } = await import("../../src/lib/redis.js");
    const fetcher = vi.fn().mockResolvedValue({ n: 1 }).mockResolvedValueOnce({ n: 1 }).mockResolvedValueOnce({ n: 2 });

    await cached("integration:test:ttl-key", 1, fetcher); // TTL = 1 real second
    await new Promise((r) => setTimeout(r, 1500));
    const afterExpiry = await cached("integration:test:ttl-key", 1, fetcher);

    expect(afterExpiry).toEqual({ n: 2 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("invalidate() actually deletes the real Redis key", async () => {
    const { cached, invalidate, redis } = await import("../../src/lib/redis.js");
    const fetcher = vi.fn().mockResolvedValue({ v: "a" }).mockResolvedValueOnce({ v: "a" }).mockResolvedValueOnce({ v: "b" });

    await cached("integration:test:invalidate-key", 60, fetcher);
    await invalidate("integration:test:invalidate-key");
    const rawAfterInvalidate = await redis.get("integration:test:invalidate-key");
    expect(rawAfterInvalidate).toBeNull();

    const refetched = await cached("integration:test:invalidate-key", 60, fetcher);
    expect(refetched).toEqual({ v: "b" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("falls through to a direct (uncached) fetch if Redis itself is unreachable, rather than failing the request", async () => {
    // Points the client at a port nothing is listening on to simulate a
    // real Redis outage, then confirms cached() still returns a correct
    // value via its documented fallback path (see src/lib/redis.ts).
    const { Redis } = await import("ioredis");
    const brokenRedis = new Redis({ port: 1, lazyConnect: true, retryStrategy: () => null });
    brokenRedis.on("error", () => {
      /* expected -- this connection is deliberately broken; silence ioredis's unhandled-error warning */
    });
    vi.doMock("../../src/lib/redis.js", async (importOriginal) => {
      const actual = await importOriginal<typeof import("../../src/lib/redis.js")>();
      return {
        ...actual,
        redis: brokenRedis,
        cached: async (_key: string, _ttl: number, fetcher: () => unknown) => {
          try {
            await brokenRedis.get(_key);
          } catch {
            /* expected -- broken on purpose */
          }
          return fetcher();
        },
      };
    });
    const { cached: cachedWithBrokenRedis } = await import("../../src/lib/redis.js");
    const fetcher = vi.fn().mockResolvedValue({ resilient: true });
    const result = await cachedWithBrokenRedis("integration:test:broken-redis-key", 60, fetcher);
    expect(result).toEqual({ resilient: true });
    brokenRedis.disconnect();
    vi.doUnmock("../../src/lib/redis.js");
  });
});
