import { Redis } from "ioredis";
import { env } from "./env.js";

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 2,
  lazyConnect: false,
});

redis.on("error", (err: Error) => {
  console.error("[redis] connection error:", err.message);
});

/**
 * GenLayer StudioNet rate-limits reads to 30 requests/minute, and Upstash
 * bills per Redis command -- so this cache is deliberately narrow and
 * deliberately short-lived: only the handful of view calls that are
 * actually read repeatedly (promise detail, reputation, platform stats,
 * config) go through here, each with its own TTL tuned to how often the
 * underlying data plausibly changes. Nothing else touches Redis.
 */
export async function cached<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
  try {
    const hit = await redis.get(key);
    if (hit !== null) {
      return JSON.parse(hit) as T;
    }
  } catch (err) {
    // A Redis hiccup must never take down a read -- fall through to a
    // direct (uncached) fetch rather than failing the request.
    console.error(`[redis] GET ${key} failed, falling back to direct fetch:`, (err as Error).message);
  }

  const value = await fetcher();

  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (err) {
    console.error(`[redis] SET ${key} failed (non-fatal):`, (err as Error).message);
  }

  return value;
}

export async function invalidate(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch (err) {
    console.error(`[redis] DEL ${key} failed (non-fatal):`, (err as Error).message);
  }
}
