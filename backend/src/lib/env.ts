import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  GENLAYER_RPC_URL: z.string().optional().default(""),
  GENLAYER_CONTRACT_ADDRESS: z.string().min(1, "GENLAYER_CONTRACT_ADDRESS is required"),
  GENLAYER_NETWORK: z.string().default("studionet"),
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),
  REDIS_URL: z.string().min(1),
  SESSION_JWT_SECRET: z.string().min(16, "SESSION_JWT_SECRET must be set to a long random string"),
  REOWN_PROJECT_ID: z.string().optional().default(""),
  PORT: z.coerce.number().default(8080),
  NODE_ENV: z.enum(["development", "production", "test"]).default("production"),
  CORS_ORIGIN: z.string().default("*"),
});

// Fails loud at boot rather than surfacing as a confusing runtime error
// later -- a financial application should never start half-configured.
const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
