import Link from "next/link";
import { Badge, Button } from "@/src/core/ui";
import type { PendingOrganizer } from "../../types/admin-overview";
import { formatDate } from "../../utils/format-date";

type OrganizerApprovalQueueProps = {
  organizers: readonly PendingOrganizer[];
  /** All waiting organizers, of which `organizers` is the first few. */
  total: number;
  viewAllHref: string;
  onApprove: (organizerId: string) => void;
  onReject: (organizerId: string) => void;
};

/**
 * Organizers waiting for an admin decision. Approve stays disabled until the applicant has
 * verified their email; the API refuses it too.
 */
export function OrganizerApprovalQueue({
  organizers,
  total,
  viewAllHref,
  onApprove,
  onReject,
}: OrganizerApprovalQueueProps) {
  return (
    <section
      aria-labelledby="approval-queue-title"
      className="overflow-hidden rounded-lg border border-line bg-surface"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 id="approval-queue-title" className="font-semibold">
            Organizer approval queue
          </h2>
          <p className="text-sm text-muted">
            Applicants can&apos;t create events until approved
          </p>
        </div>
        {total > 0 && (
          <Link href={viewAllHref} className="text-sm font-semibold text-link">
            View all {total}
          </Link>
        )}
      </div>

      {organizers.length === 0 ? (
        <p className="px-5 py-8 text-center text-muted">
          No organizers waiting for approval.
        </p>
      ) : (
        // Wide table: it scrolls inside the card on phones, not the whole page.
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-subtle text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  Organisation
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  Applicant
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  Email
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  Applied
                </th>
                <th
                  scope="col"
                  className="px-4 py-2.5 text-right font-semibold"
                >
                  Decision
                </th>
              </tr>
            </thead>
            <tbody>
              {organizers.map((organizer) => (
                <OrganizerRow
                  key={organizer.id}
                  organizer={organizer}
                  onApprove={onApprove}
                  onReject={onReject}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function OrganizerRow({
  organizer,
  onApprove,
  onReject,
}: {
  organizer: PendingOrganizer;
  onApprove: (organizerId: string) => void;
  onReject: (organizerId: string) => void;
}) {
  const name = `${organizer.organizerFirstName} ${organizer.organizerLastName}`;
  const waitingNoteId = `approve-note-${organizer.id}`;

  return (
    <tr className="border-t border-line align-middle">
      <td className="px-4 py-3.5">
        <p className="font-semibold">{organizer.organizationName}</p>
        {organizer.organizationWebsite ? (
          <a
            href={organizer.organizationWebsite}
            target="_blank"
            rel="noopener noreferrer"
            className="text-link"
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
        {formatDate(organizer.appliedAt)}
      </td>
      <td className="px-4 py-3.5">
        <div className="flex items-center justify-end gap-2">
          {!organizer.emailVerified && (
            <span id={waitingNoteId} className="text-xs text-muted">
              Waiting for email verification
            </span>
          )}
          <Button
            variant="secondary"
            onClick={() => onReject(organizer.id)}
            aria-label={`Reject ${organizer.organizationName}`}
          >
            Reject
          </Button>
          <Button
            onClick={() => onApprove(organizer.id)}
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
