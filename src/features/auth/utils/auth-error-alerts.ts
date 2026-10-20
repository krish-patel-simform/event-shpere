import type { AlertTone } from "@/src/core/ui";
import type { ApiError } from "@/src/core/api-client/base-api.service";

export type AuthAlertConfig = {
  tone: AlertTone;
  title?: string;
  message: string;
  /** Show a "Contact support" link in the message. */
  supportLink?: boolean;
  /** Show a "Try again" button: the failure may pass on the next attempt. */
  retryable?: boolean;
};

const UNEXPECTED: AuthAlertConfig = {
  tone: "error",
  title: "Something went wrong",
  message: "We couldn't reach the server. Check your connection and try again.",
  retryable: true,
};

// One entry per server `error.code` the auth forms must handle (the "Error and edge states" screen).
const BY_CODE: Record<string, AuthAlertConfig> = {
  UNAUTHENTICATED: { tone: "error", message: "Invalid email or password." },
  EMAIL_NOT_VERIFIED: {
    tone: "warning",
    title: "Verify your email first",
    message:
      "Open the link we sent to your inbox and enter the 6-digit code, then log in again.",
  },
  PASSWORD_NOT_SET: {
    tone: "info",
    title: "Your account isn't activated yet",
    message:
      "An administrator created this account for you. Use the set-password link in your invitation email.",
  },
  ACCOUNT_SUSPENDED: {
    tone: "error",
    title: "This account has been suspended",
    message: "If you think this is a mistake,",
    supportLink: true,
  },
};

/** Picks what to show for a failed auth request: by code first, then by kind of failure. */
export function getAuthAlert(error: ApiError): AuthAlertConfig {
  const byCode = BY_CODE[error.code];
  if (byCode) return byCode;

  // Network down, timeout, 5xx or a response we could not read: the user can try again.
  if (error.status === 0 || error.status >= 500) return UNEXPECTED;

  // Any other 4xx (e.g. EMAIL_TAKEN, RATE_LIMITED): the server's own message is safe to show.
  return { tone: "error", message: error.message };
}
