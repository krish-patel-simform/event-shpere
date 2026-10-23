import { z } from "zod";

const envSchema = z.object({
  POSTGRESS_DB_URL: z.string().startsWith("postgres"),
  // Signs access tokens (HS256). Generate with: openssl rand -base64 48
  AUTH_JWT_SECRET: z.string().min(32),
  // Base URL used to build links in emails (set-password, login). Set it in production.
  APP_URL: z.url().default("http://localhost:3000"),
  // Redis for the background job queue (BullMQ). Default = a Redis running locally.
  REDIS_URL: z.string().startsWith("redis").default("redis://localhost:6379"),
  // Email delivery (Resend). Only the email worker needs them, so the app boots without;
  // sendEmail checks them when it runs. EMAIL_FROM must be on a domain verified in Resend
  // (for testing, Resend allows "onboarding@resend.dev").
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  EMAIL_TO: z.string(),
  // Strapi CMS. Organizers get an admin-panel account there after an admin verifies them.
  // STRAPI_URL is also the base of the register link emailed to them (no trailing slash).
  STRAPI_URL: z.url().default("http://localhost:1337"),
  // Shared secret for the server-to-server provisioning route; must equal
  // EVENTSPHERE_PROVISION_SECRET in Strapi's .env. Only the background worker needs it, so
  // the app boots without; the Strapi client checks it when it runs.
  STRAPI_PROVISION_SECRET: z.string().min(32).optional(),
  // Strapi API token (Settings → API Tokens, Custom) for the content API, e.g. creating the
  // draft Speaker entry. Optional so the app boots without; the Strapi client checks it.
  STRAPI_API_TOKEN: z.string().min(1).optional(),
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
