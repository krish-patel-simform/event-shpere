import Link from "next/link";
import { formatDate } from "@/src/core/format/format-date";
import { Badge, ClickableRow } from "@/src/core/ui";
import type { OrganizerListItemDto } from "../schemas/organizer.schemas";
import { adminOrganizerHref } from "../routes";
import { organizerStatus, STATUS_BADGES } from "../utils/organizer-display";
import { EmptyRow, TH } from "./OrganizerPanel";

type AllOrganizersTableProps = {
  organizers: readonly OrganizerListItemDto[];
  /** A search is active, so an empty list means "no match", not "no organizers yet". */
  isFiltered: boolean;
};

/**
 * Every organizer, whatever stage the application is at. Read-only: approving, rejecting and
 * reconsidering happen on their own tabs, where the decision is the point of the list.
 */
export function AllOrganizersTable({
  organizers,
  isFiltered,
}: AllOrganizersTableProps) {
  if (organizers.length === 0) {
    return (
      <EmptyRow>
        {isFiltered ? "No organizers match your search." : "No organizers yet."}
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
              Status
            </th>
            <th scope="col" className={TH}>
              Applied
            </th>
          </tr>
        </thead>
        <tbody>
          {organizers.map((organizer) => {
            const status = STATUS_BADGES[organizerStatus(organizer)];
            return (
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
                  {organizer.organizationWebsite ? (
                    <a
                      href={organizer.organizationWebsite}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-link"
                    >
                      {organizer.organizationWebsite.replace(
                        /^https?:\/\//,
                        "",
                      )}
                    </a>
                  ) : (
                    <p className="text-muted">No website</p>
                  )}
                </td>
                <td className="px-4 py-3.5">
                  <p className="font-semibold">
                    {organizer.organizerFirstName} {organizer.organizerLastName}
                  </p>
                  <p className="text-muted">{organizer.email}</p>
                </td>
                <td className="px-4 py-3.5">
                  <Badge tone={status.tone}>{status.label}</Badge>
                </td>
                <td className="whitespace-nowrap px-4 py-3.5">
                  {formatDate(organizer.appliedAt)}
                </td>
              </ClickableRow>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
