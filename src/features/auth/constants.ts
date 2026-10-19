/** How long the emailed set-password link works. */
export const ACCOUNT_SETUP_TOKEN_TTL_HOURS = 24;
/** How long the emailed verify-email link works (the code in it expires sooner, see email/constants). */
export const EMAIL_VERIFY_TOKEN_TTL_MINUTES = 5;
export const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
export const PASSWORD_REGEX_MESSAGE =
  "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.";
