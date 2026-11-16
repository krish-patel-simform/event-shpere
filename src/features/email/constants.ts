/** How long an emailed verification code (OTP) works. */
export const EMAIL_OTP_TTL_MINUTES = 5;
/** Wrong codes allowed per emailed code; then it is deleted and a new code is needed. */
export const EMAIL_OTP_MAX_ATTEMPTS = 5;
/**
 * After a verification email is sent, the next resend for the same address waits this long.
 * The resend route is public, so without it anyone could fill someone else's inbox.
 */
export const EMAIL_OTP_RESEND_COOLDOWN_SECONDS = 60;
/**
 * After a "forgot password" email is accepted for an address, the next request for it waits this
 * long. That route is public, and every request sends an email and ends the older reset links.
 */
export const PASSWORD_RESET_REQUEST_COOLDOWN_SECONDS = 60;
