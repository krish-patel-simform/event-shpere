import { Mail } from "lucide-react";
import { ACCOUNT_SETUP_TOKEN_TTL_HOURS } from "../constants";

/** Login screen: tells admin-created organizers to use their emailed link instead. */
export function InvitedNotice() {
  return (
    <section aria-labelledby="invited-title" className="mt-6 space-y-5">
      <div className="flex items-center gap-4 text-sm text-muted">
        <span className="h-px flex-1 bg-line" />
        <h2 id="invited-title" className="font-normal">
          Invited by an administrator?
        </h2>
        <span className="h-px flex-1 bg-line" />
      </div>
      <p className="flex gap-3 rounded-md border border-line bg-surface-subtle p-4 text-sm text-muted">
        <Mail aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand" />
        <span>
          Open the <strong className="text-foreground">set-password link</strong> in your
          invitation email to activate your organizer account. The link is valid for{" "}
          {ACCOUNT_SETUP_TOKEN_TTL_HOURS} hours.
        </span>
      </p>
    </section>
  );
}
