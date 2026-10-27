import Link from "next/link";
import { Badge, Button, buttonStyles, cn } from "@/src/core/ui";
import { adminOrganizerHref } from "../../nav-items";
import type { PendingOrganizer } from "../../types/admin-overview";
import { formatDate } from "../../utils/format-date";
import {
  daysWaiting,
  OVERDUE_AFTER_DAYS,
  waitingLabel,
} from "../../utils/organizer-display";
import { EmptyRow, OrganizerSection, TH } from "./OrganizerSection";

type PendingOrganizersSectionProps = {
  organizers: readonly PendingOrganizer[];
  /** All waiting organizers on the platform, of which `organizers` are the ones shown. */
  total: number;
  /** ISO date-time "N days waiting" counts up to. */
  asOf: string;
  /** A search or filter is active, so an empty list means "no match", not "nobody waiting". */
  isFiltered: boolean;
  onApprove: (organizer: PendingOrganizer) => void;
  onReject: (organizer: PendingOrganizer) => void;
};

/**
 * Applications waiting for an admin decision, oldest first. Approve stays disabled until the
 * applicant has verified their email; the API refuses it too.
 */
export function PendingOrganizersSection({
  organizers,
  total,
  asOf,
  isFiltered,
  onApprove,
  onReject,
}: PendingOrganizersSectionProps) {
  return (
    <OrganizerSection
      id="pending"
      title="Awaiting approval"
      count={total}
      tone="warning"
      description="Oldest first. Email must be verified before an application can be approved."
    >
      {organizers.length === 0 ? (
        <EmptyRow>
          {isFiltered
            ? "No applications match your search."
            : "No organizers waiting for approval."}
        </EmptyRow>
      ) : (
        // Wide table: it scrolls inside the card on phones, not the whole page.
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-subtle text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className={TH}>
                  Organisation
                </th>
                <th scope="col" className={TH}>
                  Applicant
                </th>
                <th scope="col" className={TH}>
                  Email
                </th>
                <th scope="col" className={TH}>
                  Applied
                </th>
                <th scope="col" className={cn(TH, "text-right")}>
                  Decision
                </th>
              </tr>
            </thead>
            <tbody>
              {organizers.map((organizer) => (
                <PendingRow
                  key={organizer.id}
                  organizer={organizer}
                  asOf={asOf}
                  onApprove={onApprove}
                  onReject={onReject}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </OrganizerSection>
  );
}

function PendingRow({
  organizer,
  asOf,
  onApprove,
  onReject,
}: {
  organizer: PendingOrganizer;
  asOf: string;
  onApprove: (organizer: PendingOrganizer) => void;
  onReject: (organizer: PendingOrganizer) => void;
}) {
  const name = `${organizer.organizerFirstName} ${organizer.organizerLastName}`;
  const waitingNoteId = `approve-note-${organizer.id}`;
  const days = daysWaiting(organizer.appliedAt, asOf);

  return (
    <tr className="border-t border-line align-middle">
      <td className="px-4 py-3.5">
        <Link
          href={adminOrganizerHref(organizer.id)}
          className="font-semibold text-link hover:underline"
        >
          {organizer.organizationName}
        </Link>
        {organizer.organizationWebsite ? (
          <a
            href={organizer.organizationWebsite}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-link"
          >
            {organizer.organizationWebsite.replace(/^https?:\/\//, "")}
          </a>
        ) : (
          <p className="text-muted">No website</p>
        )}
      </td>
      <td className="px-4 py-3.5">
        <p className="font-semibold">{name}</p>
        <p className="text-muted">{organizer.email}</p>
      </td>
      <td className="px-4 py-3.5">
        {organizer.emailVerified ? (
          <Badge tone="success">Verified</Badge>
        ) : (
          <Badge tone="warning">Not verified</Badge>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-3.5">
        <p>{formatDate(organizer.appliedAt)}</p>
        <p
          className={cn(
            "text-xs font-medium",
            days > OVERDUE_AFTER_DAYS ? "text-danger" : "text-warning",
          )}
        >
          {waitingLabel(days)}
        </p>
      </td>
      <td className="px-4 py-3.5">
        <div className="flex items-center justify-end gap-2">
          {!organizer.emailVerified && (
            <span id={waitingNoteId} className="text-xs text-muted">
              Waiting for email verification
            </span>
          )}
          <Link
            href={adminOrganizerHref(organizer.id)}
            aria-label={`Review ${organizer.organizationName}`}
            className={buttonStyles({ variant: "secondary" })}
          >
            Review
          </Link>
          <Button
            variant="secondary"
            onClick={() => onReject(organizer)}
            aria-label={`Reject ${organizer.organizationName}`}
          >
            Reject
          </Button>
          <Button
            onClick={() => onApprove(organizer)}
            disabled={!organizer.emailVerified}
            aria-label={`Approve ${organizer.organizationName}`}
            aria-describedby={
              organizer.emailVerified ? undefined : waitingNoteId
            }
          >
            Approve
          </Button>
        </div>
      </td>
    </tr>
  );
}
