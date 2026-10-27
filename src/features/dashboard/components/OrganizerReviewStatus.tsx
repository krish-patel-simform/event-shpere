import { Clock, XCircle } from "lucide-react";
import Link from "next/link";
import { Badge, buttonStyles } from "@/src/core/ui";
import { formatDate } from "@/src/core/format/format-date";
import { ReviewTimeline, type ReviewStep } from "./ReviewTimeline";

// Support page does not exist yet (same as the auth footer).
const SUPPORT_HREF = "/support";

type ApplicationDetails = {
  organisationName: string;
  website: string | null;
  contactName: string;
  contactEmail: string;
  /** ISO date-time. */
  submittedAt: string;
  /** ISO date-time. */
  emailVerifiedAt: string;
};

/** Still waiting for the admin, or rejected (final) with the admin's reason. */
export type OrganizerApplication = ApplicationDetails &
  (
    | { status: "pending" }
    | {
        status: "rejected";
        /** ISO date-time. */
        rejectedAt: string;
        rejectionReason: string;
      }
  );

/**
 * Dashboard of an organizer whose organisation is not approved (PDF page 9): where the
 * application stands (under review, or rejected with the reason), what was submitted, and what
 * the user can do meanwhile.
 */
export function OrganizerReviewStatus({
  application,
}: {
  application: OrganizerApplication;
}) {
  const isRejected = application.status === "rejected";
  const steps: ReviewStep[] = [
    {
      title: "Application submitted",
      note: formatDate(application.submittedAt),
      status: "done",
    },
    {
      title: "Email verified",
      note: formatDate(application.emailVerifiedAt),
      status: "done",
    },
    isRejected
      ? {
          title: "Admin review",
          note: formatDate(application.rejectedAt),
          status: "rejected",
        }
      : { title: "Admin review", note: "In progress", status: "current" },
    {
      title: "Organizer tools unlocked",
      note: isRejected ? "Not available" : "After approval",
      status: "upcoming",
    },
  ];
  const details = [
    { label: "Organisation", value: application.organisationName },
    { label: "Website", value: application.website ?? "Not provided" },
    {
      label: "Contact",
      value: `${application.contactName} · ${application.contactEmail}`,
    },
    { label: "Submitted", value: formatDate(application.submittedAt, "long") },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <section
        aria-labelledby="review-title"
        className="space-y-6 rounded-xl border border-line bg-surface p-6"
      >
        {application.status === "rejected" ? (
          <div className="flex items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-danger-soft text-danger">
              <XCircle aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0 space-y-2">
              <Badge tone="danger">Not approved</Badge>
              <h1 id="review-title" className="text-2xl font-semibold">
                Your organizer request was not approved
              </h1>
              <p className="text-muted">
                Our team reviewed your organisation details and could not
                approve them. We also sent you this by email.
              </p>
              <div className="rounded-lg border border-line bg-surface-subtle p-4">
                <h2 className="text-sm font-semibold">Reason</h2>
                {/* Line breaks typed by the admin are kept. */}
                <p className="mt-1 whitespace-pre-line break-words text-sm">
                  {application.rejectionReason}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-warning-soft text-warning">
              <Clock aria-hidden="true" className="size-5" />
            </span>
            <div className="space-y-2">
              <Badge tone="warning">Pending review</Badge>
              <h1 id="review-title" className="text-2xl font-semibold">
                Your organizer request is under review
              </h1>
              <p className="text-muted">
                Thanks for applying. Our team is checking your organisation
                details. We&apos;ll notify you by email and in the app as soon
                as a decision is made.
              </p>
            </div>
          </div>
        )}
        <div className="border-t border-line pt-6">
          <ReviewTimeline steps={steps} />
        </div>
      </section>

      <div className="grid gap-5 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section
          aria-labelledby="details-title"
          className="space-y-4 rounded-xl border border-line bg-surface p-6"
        >
          <h2 id="details-title" className="font-semibold">
            Application details
          </h2>
          <dl className="divide-y divide-line text-sm">
            {details.map((row) => (
              <div
                key={row.label}
                className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-3 first:pt-0"
              >
                <dt className="text-muted">{row.label}</dt>
                <dd className="break-words text-right font-semibold">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-sm text-muted">
            Need to correct something?{" "}
            <Link
              href={SUPPORT_HREF}
              className="font-semibold text-link underline"
            >
              Contact support
            </Link>{" "}
            and mention your organisation name.
          </p>
        </section>

        <section
          aria-labelledby="wait-title"
          className="space-y-4 self-start rounded-xl border border-line bg-surface p-6"
        >
          <div className="space-y-1">
            <h2 id="wait-title" className="font-semibold">
              {isRejected ? "What you can do" : "While you wait"}
            </h2>
            <p className="text-sm text-muted">
              Your account already works as an attendee account.
            </p>
          </div>
          <div className="grid gap-3">
            <Link href="/events" className={buttonStyles({ fullWidth: true })}>
              Browse events
            </Link>
            <Link
              href="/profile"
              className={buttonStyles({
                variant: "secondary",
                fullWidth: true,
              })}
            >
              Complete your profile
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
