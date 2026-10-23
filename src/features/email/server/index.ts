// Server-only entry of the email feature. Other features enqueue emails through these
// functions and never touch BullMQ directly. The worker is started by scripts/email-worker.ts.
import "server-only";

export { enqueueAccountSetupEmail, enqueueCmsAccessEmail } from "./email.queue";
// Email verification codes (OTP): generated and hashed here, stored in Redis, sent directly.
export { createEmailOtp, hashEmailOtp, type EmailOtp } from "./email-otp";
export { emailOtpStore, type EmailOtpStore } from "./email-otp.store";
export { sendPasswordResetEmail, sendVerificationCodeEmail } from "./email.service";
export { EMAIL_OTP_TTL_MINUTES } from "../constants";
