import { Building2 } from "lucide-react";
import Link from "next/link";
import { buttonStyles, Card } from "@/src/core/ui";

/** Invites an attendee to apply for an organizer account; an admin reviews every request. */
export function BecomeOrganizerCard() {
  return (
    <Card>
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden="true"
          className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-soft-foreground"
        >
          <Building2 className="size-5" />
        </span>
        <div>
          <h2 className="font-semibold">Want to run your own events?</h2>
          <p className="mb-2.5 mt-0.5 text-sm text-muted">
            Apply to become an organizer. Our team reviews every request.
          </p>
          <Link
            href="/signup/organizer"
            className={buttonStyles({ variant: "secondary" })}
          >
            Become an organizer
          </Link>
        </div>
      </div>
    </Card>
  );
}
