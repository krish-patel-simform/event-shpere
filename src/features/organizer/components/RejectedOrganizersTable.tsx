import Link from "next/link";
import { formatDate } from "@/src/core/format/format-date";
import { Button, ClickableRow, cn } from "@/src/core/ui";
import { adminOrganizerHref } from "../routes";
import type { OrganizerListItemDto } from "../schemas/organizer.schemas";
import { EmptyRow, TH } from "./OrganizerPanel";

type RejectedOrganizersTableProps = {
  organizers: readonly OrganizerListItemDto[];
  /** A search is active, so an empty list means "no match", not "nobody rejected". */
  isFiltered: boolean;
  /** Puts the application back in the approval queue (the rejection is cleared). */
  onReconsider: (organizer: OrganizerListItemDto) => void;
  /** The application being reconsidered right now: its button shows it is working. */
  reconsideringId: string | null;
};

/** Rejected applications with the reason the applicant was given. They keep their attendee account. */
export function RejectedOrganizersTable({
  organizers,
  isFiltered,
  onReconsider,
  reconsideringId,
}: RejectedOrganizersTableProps) {
  if (organizers.length === 0) {
    return (
      <EmptyRow>
        {isFiltered
          ? "No rejected applications match your search."
          : "No rejected applications."}
      </EmptyRow>
    );
  }

  return (
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
              Rejected
            </th>
            <th scope="col" className={TH}>
              Reason sent to applicant
            </th>
            <th scope="col" className={cn(TH, "text-right")}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {organizers.map((organizer) => (
            <ClickableRow
              key={organizer.id}
              className="border-t border-line align-middle"
            >
              <td className="px-4 py-3.5">
                <Link
                  href={adminOrganizerHref(organizer.id)}
                  data-row-link
                  className="font-semibold text-link hover:underline"
                >
                  {organizer.organizationName}
                </Link>
              </td>
              <td className="px-4 py-3.5">
                <p>
                  {organizer.organizerFirstName} {organizer.organizerLastName}
                </p>
                <p className="text-muted">{organizer.email}</p>
              </td>
              <td className="whitespace-nowrap px-4 py-3.5">
                {organizer.rejectedAt ? formatDate(organizer.rejectedAt) : "—"}
              </td>
              <td className="max-w-sm px-4 py-3.5 text-muted">
                {organizer.rejectionReason}
              </td>
              <td className="px-4 py-3.5 text-right">
                <Button
                  variant="secondary"
                  onClick={() => onReconsider(organizer)}
                  isPending={reconsideringId === organizer.id}
                  disabled={reconsideringId !== null}
                  aria-label={`Reconsider ${organizer.organizationName}`}
                >
                  Reconsider
                </Button>
              </td>
            </ClickableRow>
          ))}
        </tbody>
      </table>
    </div>
  );
}
