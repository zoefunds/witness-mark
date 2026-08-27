import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { env } from "./lib/env.js";
import { pool } from "./db/pool.js";
import { redis } from "./lib/redis.js";
import { authRouter } from "./routes/auth.js";
import { promisesRouter } from "./routes/promises.js";
import { evidenceRouter } from "./routes/evidence.js";
import { reputationRouter, statsRouter } from "./routes/reputation.js";

// The Express app is built here, separate from index.ts's app.listen()/
// process-signal wiring, specifically so tests (see tests/*.test.ts) can
// import `app` and drive it with supertest without binding a real port or
// touching process lifecycle -- pool.ts/redis.ts still connect eagerly at
// import time, so test files mock those modules instead of exercising a
// real database/Redis.
export const app = express();

app.set("trust proxy", 1); // behind Fly's proxy

app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN.split(",").map((s) => s.trim()),
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

// A generous general limit (this is API abuse protection, not the
// StudioNet-specific limit -- that one is enforced by the Redis cache
// layer in front of genlayer reads, see src/lib/redis.ts).
app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

// --- Health checks -----------------------------------------------------
// Fly's health-check + auto-restart policy (see fly.toml) polls this to
// keep the service on 24/7: if it ever stops responding healthy, Fly
// restarts the machine automatically rather than leaving it dead.
app.get("/healthz", (_req, res) => {
  res.status(200).json({ ok: true, uptime: process.uptime() });
});

app.get("/readyz", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    await redis.ping();
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(503).json({ ok: false, error: (err as Error).message });
  }
});

// --- Routes --------------------------------------------------------------
app.use("/api/auth", authRouter);
app.use("/api/promises", promisesRouter);
app.use("/api/evidence", evidenceRouter);
app.use("/api/reputation", reputationRouter);
app.use("/api/stats", statsRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "not found" });
});

// Centralized error handler -- an unhandled route error must return a
// clean JSON 500, never crash the process (this service is required to
// run 24/7).
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[unhandled]", err);
  res.status(500).json({ error: "internal server error" });
});
