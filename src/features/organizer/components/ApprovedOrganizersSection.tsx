import Link from "next/link";
import { Avatar, cn } from "@/src/core/ui";
import { adminOrganizerHref } from "../../nav-items";
import type { ApprovedOrganizer } from "../../types/admin-organizers";
import { formatDate } from "../../utils/format-date";
import { formatCount } from "../../utils/format-number";
import { formatEventCounts } from "../../utils/organizer-display";
import { EmptyRow, OrganizerSection, TH } from "./OrganizerSection";
import { TablePagination } from "./TablePagination";

type ApprovedOrganizersSectionProps = {
  /** One page of approved organizers. */
  organizers: readonly ApprovedOrganizer[];
  /** All approved organizers on the platform. */
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  isFiltered: boolean;
};

/** Organizers who can create, edit and publish their own events. */
export function ApprovedOrganizersSection({
  organizers,
  total,
  page,
  pageSize,
  onPageChange,
  isFiltered,
}: ApprovedOrganizersSectionProps) {
  return (
    <OrganizerSection
      id="approved"
      title="Approved organizers"
      count={total}
      tone="success"
      description="Can create, edit and publish their own events"
    >
      {organizers.length === 0 ? (
        <EmptyRow>
          {isFiltered
            ? "No approved organizers match your search."
            : "No approved organizers yet."}
        </EmptyRow>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-subtle text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className={TH}>
                    Organisation
                  </th>
                  <th scope="col" className={TH}>
                    Events
                  </th>
                  <th scope="col" className={cn(TH, "text-right")}>
                    Registrations
                  </th>
                  <th scope="col" className={TH}>
                    Approved
                  </th>
                </tr>
              </thead>
              <tbody>
                {organizers.map((organizer) => (
                  <tr
                    key={organizer.id}
                    className="border-t border-line align-middle"
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={organizer.organizationName} />
                        <div className="min-w-0">
                          <Link
                            href={adminOrganizerHref(organizer.id)}
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
                      {formatEventCounts(organizer.events)}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums">
                      {formatCount(organizer.registrations)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5">
                      <p>{formatDate(organizer.verifiedAt)}</p>
                      <p className="text-xs text-muted">
                        by {organizer.verifiedBy}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePagination
            page={page}
            pageSize={pageSize}
            total={total}
            itemCount={organizers.length}
            onPageChange={onPageChange}
          />
        </>
      )}
    </OrganizerSection>
  );
}
