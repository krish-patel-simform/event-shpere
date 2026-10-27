import Link from "next/link";
import { formatDate } from "@/src/core/format/format-date";
import { Badge, Button, buttonStyles, ClickableRow, cn } from "@/src/core/ui";
import { adminOrganizerHref } from "../routes";
import type { PendingOrganizer } from "../types/admin-organizers";
import {
  daysWaiting,
  OVERDUE_AFTER_DAYS,
  waitingLabel,
} from "../utils/organizer-display";
import { EmptyRow, TH } from "./OrganizerPanel";

type PendingOrganizersTableProps = {
  organizers: readonly PendingOrganizer[];
  /** ISO date-time "N days waiting" counts up to (when the list was loaded); undefined: no waiting line. */
  asOf: string | undefined;
  /** A search or filter is active, so an empty list means "no match", not "nobody waiting". */
  isFiltered: boolean;
  onApprove: (organizer: PendingOrganizer) => void;
  onReject: (organizer: PendingOrganizer) => void;
};

/**
 * Applications waiting for an admin decision. Approve stays disabled until the applicant has
 * verified their email; the API refuses it too.
 */
export function PendingOrganizersTable({
  organizers,
  asOf,
  isFiltered,
  onApprove,
  onReject,
}: PendingOrganizersTableProps) {
  if (organizers.length === 0) {
    return (
      <EmptyRow>
        {isFiltered
          ? "No applications match your search."
          : "No organizers waiting for approval."}
      </EmptyRow>
    );
  }

  return (
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
  );
}

function PendingRow({
  organizer,
  asOf,
  onApprove,
  onReject,
}: {
  organizer: PendingOrganizer;
  asOf: string | undefined;
  onApprove: (organizer: PendingOrganizer) => void;
  onReject: (organizer: PendingOrganizer) => void;
}) {
  const name = `${organizer.organizerFirstName} ${organizer.organizerLastName}`;
  const waitingNoteId = `approve-note-${organizer.id}`;
  const days = asOf ? daysWaiting(organizer.appliedAt, asOf) : null;

  return (
    <ClickableRow className="border-t border-line align-middle">
      <td className="px-4 py-3.5">
        <Link
          href={adminOrganizerHref(organizer.id)}
          data-row-link
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
        {days !== null && (
          <p
            className={cn(
              "text-xs font-medium",
              days > OVERDUE_AFTER_DAYS ? "text-danger" : "text-warning",
            )}
          >
            {waitingLabel(days)}
          </p>
        )}
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
    </ClickableRow>
  );
}
