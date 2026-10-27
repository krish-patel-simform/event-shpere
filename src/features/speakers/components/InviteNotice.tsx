import type { ApiError } from "@/src/core/api-client/base-api.service";
import { Alert } from "@/src/core/ui";

/** The result of the last "Resend invite": who got it, a warning, or why it failed. */
export type InviteResult = { name: string; setupEmailQueued: boolean };

/**
 * The message under the title after an admin resent a speaker's invite. The speaker's email is
 * not known to this page (the public API does not send it), so the message names the speaker.
 */
export function InviteNotice({
  result,
  error,
}: {
  result: InviteResult | null;
  error: ApiError | null;
}) {
  if (error) {
    return (
      <Alert tone="error" title="We couldn't send the invite">
        {error.message}
      </Alert>
    );
  }
  if (!result) return null;
  return result.setupEmailQueued ? (
    <Alert tone="success" title={`Invite sent to ${result.name}`}>
      The earlier link no longer works. They set a password from this one.
    </Alert>
  ) : (
    <Alert
      tone="warning"
      title="The new invite was saved, but the email was not sent"
    >
      We couldn&apos;t queue the email to {result.name}. Try again in a minute.
    </Alert>
  );
}
