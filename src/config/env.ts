import { z } from "zod";

const envSchema = z.object({
  POSTGRESS_DB_URL: z.string().startsWith("postgres"),
});

const envSchemaParse = envSchema.safeParse(process.env);

if (!envSchemaParse.success) {
  throw new Error(envSchemaParse.error.message);
}

export const env = envSchemaParse.data;
