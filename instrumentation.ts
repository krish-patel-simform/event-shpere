export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { sql } = await import("drizzle-orm");
  const { db } = await import("./src/db/dbClient");

  try {
    await db.execute(sql`select 1`);
    console.log("[db] connected to Neon");
  } catch (error) {
    console.error("[db] connection failed", error);
  }
}
