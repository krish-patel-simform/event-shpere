import { Button, cn } from "@/src/core/ui";
import type { RejectedOrganizer } from "../../types/admin-organizers";
import { formatDate } from "../../utils/format-date";
import { EmptyRow, OrganizerSection, TH } from "./OrganizerSection";

type RejectedOrganizersSectionProps = {
  organizers: readonly RejectedOrganizer[];
  /** All rejected applications on the platform. */
  total: number;
  isFiltered: boolean;
  /** Puts the application back in the approval queue (the rejection is cleared). */
  onReconsider: (organizer: RejectedOrganizer) => void;
};

/** Rejected applications with the reason the applicant was given. They keep their attendee account. */
export function RejectedOrganizersSection({
  organizers,
  total,
  isFiltered,
  onReconsider,
}: RejectedOrganizersSectionProps) {
  return (
    <OrganizerSection
      id="rejected"
      title="Rejected applications"
      count={total}
      tone="danger"
      description="Applicants stay on their attendee account"
    >
      {organizers.length === 0 ? (
        <EmptyRow>
          {isFiltered
            ? "No rejected applications match your search."
            : "No rejected applications."}
        </EmptyRow>
      ) : (
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
                <tr
                  key={organizer.id}
                  className="border-t border-line align-middle"
                >
                  <td className="px-4 py-3.5 font-semibold">
                    {organizer.organizationName}
                  </td>
                  <td className="px-4 py-3.5">
                    {organizer.organizerFirstName} {organizer.organizerLastName}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5">
                    {formatDate(organizer.rejectedAt)}
                  </td>
                  <td className="max-w-sm px-4 py-3.5 text-muted">
                    {organizer.rejectionReason}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <Button
                      variant="secondary"
                      onClick={() => onReconsider(organizer)}
                      aria-label={`Reconsider ${organizer.organizationName}`}
                    >
                      Reconsider
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </OrganizerSection>
  );
}
