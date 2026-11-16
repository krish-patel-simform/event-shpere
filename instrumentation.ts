export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { sql } = await import("drizzle-orm");
  const { db } = await import("./src/db/dbClient");
  const { describeError } = await import("./src/core/http/safe-error");

  try {
    await db.execute(sql`select 1`);
    console.log("[db] connected to Neon");
  } catch (error) {
    // Not the raw error: it carries the driver's details (host, user, query). What failed and
    // where is enough, the same as for a failed request.
    console.error("[db] connection failed", describeError(error));
  }
}
