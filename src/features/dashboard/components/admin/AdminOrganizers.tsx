"use client";

import { useLayoutEffect, useState } from "react";
import { cn } from "@/src/core/ui";
import type { AdminOrganizersData } from "../../types/admin-organizers";
import type { PendingOrganizer } from "../../types/admin-overview";
import { formatCount } from "../../utils/format-number";
import { ApprovedOrganizersSection } from "./ApprovedOrganizersSection";
import {
  ApproveOrganizerDialog,
  RejectOrganizerDialog,
} from "./OrganizerDecisionDialogs";
import {
  OrganizerFilters,
  type EmailFilter,
  type OrganizerSort,
} from "./OrganizerFilters";
import { PendingOrganizersSection } from "./PendingOrganizersSection";
import { RejectedOrganizersSection } from "./RejectedOrganizersSection";

type AdminOrganizersProps = {
  data: AdminOrganizersData;
  // TODO(API): approve = POST /api/admin/organizers/:id/verify,
  // reject = POST /api/admin/organizers/:id/reject with { reason },
  // reconsider = POST /api/admin/organizers/:id/reopen. Until then nothing is sent.
  onApprove?: (organizerId: string) => void;
  onReject?: (organizerId: string, reason: string) => void;
  onReconsider?: (organizerId: string) => void;
  onApprovedPageChange?: (page: number) => void;
};

/** The decision the admin is being asked to confirm: one dialog is open at a time. */
type Decision = { kind: "approve" | "reject"; organizer: PendingOrganizer };

const noop = () => undefined;

function matches(query: string, ...fields: string[]): boolean {
  const needle = query.trim().toLowerCase();
  return (
    needle === "" ||
    fields.some((field) => field.toLowerCase().includes(needle))
  );
}

/**
 * The admin's Organizers page: applications waiting for a decision (approve, reject with a
 * reason), approved organizers, and rejected applications (reconsider puts one back in the queue).
 * Search filters all three lists; the email filter and sort apply to the waiting list.
 * TODO(API): search, filter and paging become query parameters of the list endpoint.
 */
export function AdminOrganizers({
  data,
  onApprove = noop,
  onReject = noop,
  onReconsider = noop,
  onApprovedPageChange = noop,
}: AdminOrganizersProps) {
  const [search, setSearch] = useState("");
  const [emailFilter, setEmailFilter] = useState<EmailFilter>("any");
  const [sort, setSort] = useState<OrganizerSort>("oldest");
  const [decision, setDecision] = useState<Decision | null>(null);

  // Leaving the page hides it (React <Activity>) instead of unmounting it, so an open dialog
  // would still be open when the admin comes back. Close it as the page is hidden.
  useLayoutEffect(() => () => setDecision(null), []);

  const isFiltered = search.trim() !== "" || emailFilter !== "any";
  const direction = sort === "oldest" ? 1 : -1;

  const pending = data.pending
    .filter((organizer) =>
      matches(
        search,
        organizer.organizationName,
        `${organizer.organizerFirstName} ${organizer.organizerLastName}`,
        organizer.email,
      ),
    )
    .filter(
      (organizer) =>
        emailFilter === "any" ||
        organizer.emailVerified === (emailFilter === "verified"),
    )
    .sort(
      (a, b) => direction * (Date.parse(a.appliedAt) - Date.parse(b.appliedAt)),
    );
  const approved = data.approved.filter((organizer) =>
    matches(
      search,
      organizer.organizationName,
      `${organizer.organizerFirstName} ${organizer.organizerLastName}`,
      organizer.email,
    ),
  );
  const rejected = data.rejected.filter((organizer) =>
    matches(
      search,
      organizer.organizationName,
      `${organizer.organizerFirstName} ${organizer.organizerLastName}`,
    ),
  );

  const summary = [
    {
      href: "#pending",
      count: data.counts.pending,
      label: "Awaiting approval",
      tone: "text-warning",
    },
    {
      href: "#approved",
      count: data.counts.approved,
      label: "Approved organizers",
      tone: "text-success",
    },
    {
      href: "#rejected",
      count: data.counts.rejected,
      label: "Rejected applications",
      tone: "text-danger",
    },
  ];

  const closeDialog = () => setDecision(null);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">Organizers</h1>
        <p className="text-muted">
          Review organizer applications and manage approved organizers.
        </p>
      </header>

      <ul className="flex flex-wrap gap-4">
        {summary.map((item) => (
          <li key={item.href} className="min-w-48 flex-1">
            <a
              href={item.href}
              className="flex items-center gap-3.5 rounded-lg border border-line bg-surface px-4 py-3.5 hover:bg-surface-subtle"
            >
              <span className={cn("text-2xl font-semibold", item.tone)}>
                {formatCount(item.count)}
              </span>
              <span className="font-medium text-muted">{item.label}</span>
            </a>
          </li>
        ))}
      </ul>

      <OrganizerFilters
        search={search}
        onSearchChange={setSearch}
        emailFilter={emailFilter}
        onEmailFilterChange={setEmailFilter}
        sort={sort}
        onSortChange={setSort}
      />

      <PendingOrganizersSection
        organizers={pending}
        total={data.counts.pending}
        asOf={data.asOf}
        isFiltered={isFiltered}
        onApprove={(organizer) => setDecision({ kind: "approve", organizer })}
        onReject={(organizer) => setDecision({ kind: "reject", organizer })}
      />
      <ApprovedOrganizersSection
        organizers={approved}
        total={data.counts.approved}
        page={data.approvedPage.page}
        pageSize={data.approvedPage.pageSize}
        onPageChange={onApprovedPageChange}
        isFiltered={search.trim() !== ""}
      />
      <RejectedOrganizersSection
        organizers={rejected}
        total={data.counts.rejected}
        isFiltered={search.trim() !== ""}
        onReconsider={(organizer) => onReconsider(organizer.id)}
      />

      <ApproveOrganizerDialog
        organizer={decision?.kind === "approve" ? decision.organizer : null}
        onClose={closeDialog}
        onConfirm={() => {
          if (decision) onApprove(decision.organizer.id);
          closeDialog();
        }}
      />
      <RejectOrganizerDialog
        organizer={decision?.kind === "reject" ? decision.organizer : null}
        onClose={closeDialog}
        onConfirm={(reason) => {
          if (decision) onReject(decision.organizer.id, reason);
          closeDialog();
        }}
      />
    </div>
  );
}
