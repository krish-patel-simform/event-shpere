import { Check, ExternalLink, Info, Mail, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { roleLabel } from "@/src/core/auth/role-label";
import { formatDate } from "@/src/core/format/format-date";
import {
  Avatar,
  Badge,
  Button,
  Card,
  cn,
  DescriptionList,
  Timeline,
} from "@/src/core/ui";
import type { OrganizerDetailDto } from "../schemas/organizer.schemas";
import {
  buildChecks,
  buildHistory,
  type CheckState,
} from "../utils/organizer-review";
import { STATUS_BADGES } from "../utils/organizer-display";

const ACCOUNT_STATUS_LABELS = {
  active: "Active",
  suspended: "Suspended",
  pending: "Pending (no password yet)",
} as const;

/** The organisation the applicant filled in, and where the application stands. */
export function OrganisationCard({ review }: { review: OrganizerDetailDto }) {
  const status = STATUS_BADGES[review.status];
  return (
    <Card title="Organisation">
      <DescriptionList
        items={[
          { label: "Organisation name", value: review.organizationName },
          {
            label: "Website",
            value: review.organizationWebsite ? (
              <a
                href={review.organizationWebsite}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-link hover:underline"
              >
                {review.organizationWebsite.replace(/^https?:\/\//, "")}
                <ExternalLink aria-hidden="true" className="size-3.5" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            ) : (
              <span className="font-normal text-muted">No website</span>
            ),
          },
          {
            label: "Submitted",
            value: formatDate(review.appliedAt, "long"),
          },
          {
            label: "Application status",
            value: <Badge tone={status.tone}>{status.label}</Badge>,
          },
        ]}
      />
    </Card>
  );
}

/** The person who applied: their account, so the admin knows who they are deciding about. */
export function ApplicantCard({
  review,
  profileHref,
  onResendInvite,
  isResendingInvite = false,
}: {
  review: OrganizerDetailDto;
  /** The applicant's user profile page. Left out, there is no link. */
  profileHref?: string;
  /**
   * Sends the applicant a new set-password invite. Offered only while their account is pending
   * (they have not set a password yet); left out, there is no button.
   */
  onResendInvite?: () => void;
  /** The invite is being sent: the button shows it and cannot be pressed twice. */
  isResendingInvite?: boolean;
}) {
  const { applicant } = review;
  const name = `${applicant.firstName} ${applicant.lastName}`;
  const canResend = onResendInvite && applicant.accountStatus === "pending";
  return (
    <Card
      title="Applicant account"
      action={
        (profileHref || canResend) && (
          <div className="flex flex-wrap items-center gap-3">
            {canResend && (
              <Button
                variant="secondary"
                onClick={onResendInvite}
                isPending={isResendingInvite}
              >
                <Mail aria-hidden="true" className="size-4" />
                {isResendingInvite ? "Sending…" : "Resend invite"}
              </Button>
            )}
            {profileHref && (
              <Link
                href={profileHref}
                className="text-sm font-semibold text-link hover:underline"
              >
                Open user profile
              </Link>
            )}
          </div>
        )
      }
    >
      <div className="mb-4 flex items-center gap-3">
        <Avatar name={name} className="size-12 text-base" />
        <div className="min-w-0">
          <p className="text-base font-semibold">{name}</p>
          <p className="break-words text-muted">{applicant.email}</p>
        </div>
      </div>
      <DescriptionList
        items={[
          {
            label: "Email",
            value: applicant.emailVerifiedAt ? (
              <>
                <Badge tone="success">Verified</Badge>{" "}
                <span className="font-normal text-muted">
                  {formatDate(applicant.emailVerifiedAt, "long")}
                </span>
              </>
            ) : (
              <Badge tone="warning">Not verified</Badge>
            ),
          },
          {
            label: "Current role",
            value: applicant.role ? (
              <Badge tone="brand">{roleLabel(applicant.role)}</Badge>
            ) : (
              <span className="font-normal text-muted">No role</span>
            ),
          },
          {
            label: "Account",
            value: `${ACCOUNT_STATUS_LABELS[applicant.accountStatus]} · created ${formatDate(applicant.createdAt)}`,
          },
        ]}
      />
    </Card>
  );
}

const CHECK_STYLES: Record<
  CheckState,
  { icon: typeof Check; box: string; label: string }
> = {
  pass: { icon: Check, box: "bg-success-soft text-success", label: "Passed" },
  fail: {
    icon: TriangleAlert,
    box: "bg-danger-soft text-danger",
    label: "Needs attention",
  },
  manual: {
    icon: Info,
    box: "bg-surface-subtle text-muted",
    label: "Check by hand",
  },
};

/** What to look at before approving. Each line says whether it passed, so colour is not the only cue. */
export function ChecksCard({ review }: { review: OrganizerDetailDto }) {
  return (
    <Card
      title="Checks before approving"
      description="Review these before you decide"
      flush
    >
      <ul className="divide-y divide-line px-5">
        {buildChecks(review).map((check) => {
          const { icon: Icon, box, label } = CHECK_STYLES[check.state];
          return (
            <li key={check.key} className="flex gap-3 py-3">
              <span
                aria-hidden="true"
                className={cn(
                  "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full",
                  box,
                )}
              >
                <Icon className="size-3" strokeWidth={2.6} />
              </span>
              <div>
                <p className="font-semibold">
                  {check.title}
                  <span className="sr-only"> ({label})</span>
                </p>
                <p className="text-sm text-muted">{check.detail}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** What happened to the application so far, newest first. */
export function HistoryCard({ review }: { review: OrganizerDetailDto }) {
  return (
    <Card title="History">
      <Timeline items={buildHistory(review)} strongTitles />
    </Card>
  );
}
