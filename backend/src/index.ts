import { env } from "./lib/env.js";
import { pool } from "./db/pool.js";
import { app } from "./app.js";

const server = app.listen(env.PORT, () => {
  console.log(`WitnessMark backend listening on :${env.PORT} (${env.NODE_ENV})`);
});

// Never let an unexpected rejection kill the process outright -- log and
// keep serving; Fly's restart policy is the last resort, not the first.
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    console.log(`${signal} received, shutting down gracefully...`);
    server.close(() => {
      pool.end().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}
