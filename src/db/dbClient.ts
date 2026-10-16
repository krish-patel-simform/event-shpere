import "server-only";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { env } from "../config/env";
import * as schema from "./schemas";

const createDb = () =>
  drizzle({
    client: new Pool({ connectionString: env.POSTGRESS_DB_URL, max: 5 }),
    schema,
  });

export type Db = ReturnType<typeof createDb>;

// Next hot-reloads modules in dev; reuse one pool instead of opening a new one each time.
const globalForDb = globalThis as unknown as { db?: Db };

export const db = globalForDb.db ?? createDb();

if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
}
