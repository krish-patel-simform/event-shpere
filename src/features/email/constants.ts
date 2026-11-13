/** How long an emailed verification code (OTP) works. */
export const EMAIL_OTP_TTL_MINUTES = 5;
/** Wrong codes allowed per emailed code; then it is deleted and a new code is needed. */
export const EMAIL_OTP_MAX_ATTEMPTS = 5;
/**
 * After a verification email is sent, the next resend for the same address waits this long.
 * The resend route is public, so without it anyone could fill someone else's inbox.
 */
export const EMAIL_OTP_RESEND_COOLDOWN_SECONDS = 60;
