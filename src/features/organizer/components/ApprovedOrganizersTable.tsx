import Link from "next/link";
import { formatDate } from "@/src/core/format/format-date";
import { Avatar, ClickableRow } from "@/src/core/ui";
import type { OrganizerListItemDto } from "../schemas/organizer.schemas";
import { adminOrganizerHref } from "../routes";
import { EmptyRow, TH } from "./OrganizerPanel";

type ApprovedOrganizersTableProps = {
  organizers: readonly OrganizerListItemDto[];
  /** A search is active, so an empty list means "no match", not "nobody approved yet". */
  isFiltered: boolean;
};

/** Organizers who can create, edit and publish their own events. */
export function ApprovedOrganizersTable({
  organizers,
  isFiltered,
}: ApprovedOrganizersTableProps) {
  if (organizers.length === 0) {
    return (
      <EmptyRow>
        {isFiltered
          ? "No approved organizers match your search."
          : "No approved organizers yet."}
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
              Approved
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
                <div className="flex items-center gap-3">
                  <Avatar name={organizer.organizationName} />
                  <div className="min-w-0">
                    <Link
                      href={adminOrganizerHref(organizer.id)}
                      data-row-link
                      className="font-semibold text-link hover:underline"
                    >
                      {organizer.organizationName}
                    </Link>
                    <p className="text-muted">
                      {organizer.organizerFirstName}{" "}
                      {organizer.organizerLastName} · {organizer.email}
                    </p>
                  </div>
                </div>
              </td>
              <td className="whitespace-nowrap px-4 py-3.5">
                {organizer.verifiedAt ? (
                  <>
                    <p>{formatDate(organizer.verifiedAt)}</p>
                    {organizer.verifiedBy && (
                      <p className="text-xs text-muted">
                        by {organizer.verifiedBy}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-muted">—</p>
                )}
              </td>
            </ClickableRow>
          ))}
        </tbody>
      </table>
    </div>
  );
}
