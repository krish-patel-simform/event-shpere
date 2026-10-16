import "server-only";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { env } from "../config/env";
import * as schema from "./schemas";

const connectDb = () => {
  const poolDbClient = new Pool({
    connectionString: env.POSTGRESS_DB_URL,
    max: 5,
  });

  poolDbClient.on("error", (err: Error) => {
    console.error("❌ Unexpected database error:", err);
  });
  return drizzle({
    client: poolDbClient,
    schema,
  });
};

export type Db = ReturnType<typeof connectDb>;

// Next hot-reloads modules in dev; reuse one pool instead of opening a new one each time.
const globalForDb = globalThis as unknown as { db?: Db };

export const db = globalForDb.db ?? connectDb();

if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
}
