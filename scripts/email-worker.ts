// Background email worker: a separate, long-running process (Vercel functions cannot host it).
// Run with: npm run worker:email   (needs a running Redis at REDIS_URL, and RESEND_API_KEY + EMAIL_FROM)
//
// `--conditions=react-server` in the npm script turns `server-only` imports into no-ops,
// the same way the seed script reuses server code.
import "dotenv/config";
import { startEmailWorker } from "../src/features/email/server/email.worker";

const worker = startEmailWorker();
console.log("[email] worker started, waiting for jobs…");

// Finish the job in progress before exiting (Ctrl+C or a platform shutdown).
async function shutdown(signal: string) {
  console.log(`[email] ${signal} received, closing worker…`);
  await worker.close();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
