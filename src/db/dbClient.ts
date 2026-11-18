import "server-only";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { env } from "../config/env";
import * as schema from "./schemas";

// How long a query may wait for a free connection (all 5 busy, or the database not answering)
// before it fails. Without it the wait is endless and every request in a rush just hangs. After
// it, route() answers 503 + Retry-After (see core/http/database-unavailable.ts).
// It must be well above the time to OPEN a connection (measured 3.5-4 s against hosted Neon from a
// dev machine, and a rush of requests queues behind each other), or ordinary slowness becomes
// false 503s: at 5 s, 3 of 6 parallel requests failed. It must stay below the browser's own
// request timeout (15 s, core/api-client/base-api.service.ts), or the browser gives up first and
// the user sees a network error instead of this 503.
export const DB_CONNECTION_TIMEOUT_MS = 10_000;

const connectDb = () => {
  const poolDbClient = new Pool({
    connectionString: env.POSTGRESS_DB_URL,
    max: 5,
    connectionTimeoutMillis: DB_CONNECTION_TIMEOUT_MS,
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
