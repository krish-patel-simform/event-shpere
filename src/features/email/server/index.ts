// Server-only entry of the email feature. Other features enqueue emails through these
// functions and never touch BullMQ directly. The worker is started by scripts/email-worker.ts.
import "server-only";

export { enqueueAccountSetupEmail } from "./email.queue";
