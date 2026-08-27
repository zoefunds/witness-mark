// Runs before any test module (and therefore before src/lib/env.ts's
// dotenv.config() call, which never overrides an already-set process.env
// value) so the whole test suite runs against safe placeholder config
// rather than needing real secrets or a real database/Redis/GenLayer
// connection. Individual test files mock db/pool.js, lib/redis.js,
// lib/genlayer.js, and lib/cloudinary.js at the module level for anything
// that would otherwise need a live connection.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
process.env.GENLAYER_CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000000";
process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
process.env.CLOUDINARY_API_KEY = "test-key";
process.env.CLOUDINARY_API_SECRET = "test-secret";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.SESSION_JWT_SECRET = "test-session-secret-at-least-16-chars";
process.env.REOWN_PROJECT_ID = "test-project-id";
process.env.CORS_ORIGIN = "http://localhost:3000";
process.env.PORT = "0";
