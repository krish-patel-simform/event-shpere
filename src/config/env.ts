import { z } from "zod";

const envSchema = z.object({
  POSTGRESS_DB_URL: z.string().startsWith("postgres"),
  // Signs access tokens (HS256). Generate with: openssl rand -base64 48
  AUTH_JWT_SECRET: z.string().min(32),
  // Only the seed script needs these, so they stay optional: the app must still boot
  // (locally and on Vercel) without them. seedAdmin validates them when it runs.
  SEED_ADMIN_EMAIL: z.string().optional(),
  SEED_ADMIN_PASSWORD: z.string().optional(),
});

const envSchemaParse = envSchema.safeParse(process.env);

if (!envSchemaParse.success) {
  throw new Error(envSchemaParse.error.message);
}

export const env = envSchemaParse.data;
