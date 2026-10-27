"use client";

import { Plus } from "lucide-react";
import { useLayoutEffect, useState } from "react";
import { formatCount } from "@/src/core/format/format-number";
import { useDebouncedValue } from "@/src/core/hooks/use-debounced-value";
import { Alert, Button, TablePagination, Tabs } from "@/src/core/ui";
import { useCreateOrganizer } from "../hooks/useCreateOrganizer";
import { useGetOrganizerList } from "../hooks/useGetOrganizerList";
import { useReopenOrganizer } from "../hooks/useReopenOrganizer";
import { useRejectOrganizer } from "../hooks/useRejectOrganizer";
import { useVerifyOrganizer } from "../hooks/useVerifyOrganizer";
import type {
  CreateOrganizerResponseDto,
  OrganizerSort,
} from "../schemas/organizer.schemas";
import type {
  OrganizerTabKey,
  PendingOrganizer,
} from "../types/admin-organizers";
import {
  defaultSort,
  ORGANIZER_TABS,
  TAB_DESCRIPTIONS,
  tabVerification,
} from "../utils/organizer-display";
import { AllOrganizersTable } from "./AllOrganizersTable";
import { ApprovedOrganizersTable } from "./ApprovedOrganizersTable";
import { CreateOrganizerDialog } from "./CreateOrganizerDialog";
import {
  ApproveOrganizerDialog,
  RejectOrganizerDialog,
} from "./OrganizerDecisionDialogs";
import { OrganizerFilters, type EmailFilter } from "./OrganizerFilters";
import { OrganizerPanel } from "./OrganizerPanel";
import { PendingOrganizersTable } from "./PendingOrganizersTable";
import { RejectedOrganizersTable } from "./RejectedOrganizersTable";

const PAGE_SIZE = 10;
const SEARCH_DELAY_MS = 300;
const PANEL_ID = "organizers-panel";

/** The decision the admin is being asked to confirm: one dialog is open at a time. */
type Decision = { kind: "approve" | "reject"; organizer: PendingOrganizer };

/**
 * The admin's Organizers page: one tab per list (awaiting approval, approved, rejected, all),
 * with one search box and the filters that make sense for the selected tab. Search, the email
 * filter, the sort and the paging are all done by the server (GET /api/admin/organizers). Only
 * the selected tab is requested: another list is loaded when the admin opens it, not before.
 * A waiting application can be approved or rejected with a reason; a rejected one can be
 * reconsidered. The admin can also create an organizer, who is emailed a link to set a password.
 */
export function AdminOrganizers() {
  // Opens on the first tab, like the Users page.
  const [tab, setTab] = useState<OrganizerTabKey>("all");
  const [search, setSearch] = useState("");
  const [emailFilter, setEmailFilter] = useState<EmailFilter>("any");
  const [sort, setSort] = useState<OrganizerSort>(defaultSort("all"));
  const [page, setPage] = useState(1);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  // The organizer created last: the message under the title says what happens next.
  const [created, setCreated] = useState<CreateOrganizerResponseDto | null>(
    null,
  );

  // The box updates at once; the API is asked once the admin stops typing.
  const term = useDebouncedValue(search.trim(), SEARCH_DELAY_MS);

  // The email filter exists only on the waiting list: it is never sent for the others.
  const emailVerified =
    tab === "pending" && emailFilter !== "any"
      ? emailFilter === "verified"
      : undefined;

  const list = useGetOrganizerList({
    verification: tabVerification(tab),
    search: term,
    emailVerified,
    sort,
    page,
    pageSize: PAGE_SIZE,
  });

  const verify = useVerifyOrganizer();
  const reject = useRejectOrganizer();
  const reopen = useReopenOrganizer();
  const create = useCreateOrganizer();

  // Leaving the page hides it (React <Activity>) instead of unmounting it, so an open dialog
  // would still be open when the admin comes back. Close it as the page is hidden.
  useLayoutEffect(
    () => () => {
      setDecision(null);
      setIsCreating(false);
    },
    [],
  );

  // A new filter or search starts again from the first page.
  const changed = <T,>(set: (value: T) => void) => {
    return (value: T) => {
      set(value);
      setPage(1);
    };
  };

  // Each list has its own sort choices and only the waiting list has the email filter, so
  // leaving a tab drops both.
  const changeTab = (next: OrganizerTabKey) => {
    setTab(next);
    setSort(defaultSort(next));
    setEmailFilter("any");
    setPage(1);
  };

  const isFiltered = term !== "" || emailVerified !== undefined;
  const rows = list.data?.items ?? [];
  const total = list.data?.meta.total ?? 0;
  // A failed load shows an error only when there is nothing to show; otherwise the rows we have
  // stay on screen.
  const error =
    list.isError && !list.data ? (list.error?.message ?? "Try again.") : null;

  const closeDialog = () => {
    verify.reset();
    reject.reset();
    setDecision(null);
  };

  const openCreate = () => {
    setCreated(null);
    setIsCreating(true);
  };
  const closeCreate = () => {
    create.reset();
    setIsCreating(false);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Organizers</h1>
          <p className="text-muted">
            Review organizer applications and manage approved organizers.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus aria-hidden="true" className="size-4" />
          Create organizer
        </Button>
      </header>

      {created &&
        (created.setupEmailQueued ? (
          <Alert tone="success" title={`${created.organizationName} created`}>
            We emailed {created.email} a link to set a password. The application
            is under Awaiting approval.
          </Alert>
        ) : (
          <Alert
            tone="warning"
            title={`${created.organizationName} created, but the email was not sent`}
          >
            The account exists, but we couldn&apos;t queue the email to{" "}
            {created.email}. The setup link still has to be sent.
          </Alert>
        ))}

      <Tabs
        label="Filter organizers"
        tabs={ORGANIZER_TABS}
        value={tab}
        onChange={changeTab}
        panelId={PANEL_ID}
      />

      <OrganizerFilters
        tab={tab}
        search={search}
        onSearchChange={changed(setSearch)}
        emailFilter={emailFilter}
        onEmailFilterChange={changed(setEmailFilter)}
        sort={sort}
        onSortChange={changed(setSort)}
      />

      {reopen.isError && (
        <Alert tone="error" title="We couldn't reconsider this application">
          {reopen.error.message}
        </Alert>
      )}

      <OrganizerPanel
        panelId={PANEL_ID}
        tab={tab}
        description={TAB_DESCRIPTIONS[tab]}
        summary={
          list.data
            ? `${formatCount(total)} ${isFiltered ? "matching" : "in total"}`
            : undefined
        }
        isLoading={list.isPending}
        error={error}
        onRetry={() => void list.refetch()}
      >
        {tab === "pending" && (
          <PendingOrganizersTable
            organizers={rows}
            // "N days waiting" counts up to the moment this list was loaded.
            asOf={
              list.dataUpdatedAt > 0
                ? new Date(list.dataUpdatedAt).toISOString()
                : undefined
            }
            isFiltered={isFiltered}
            onApprove={(organizer) =>
              setDecision({ kind: "approve", organizer })
            }
            onReject={(organizer) => setDecision({ kind: "reject", organizer })}
          />
        )}
        {tab === "verified" && (
          <ApprovedOrganizersTable organizers={rows} isFiltered={isFiltered} />
        )}
        {tab === "rejected" && (
          <RejectedOrganizersTable
            organizers={rows}
            isFiltered={isFiltered}
            onReconsider={(organizer) => reopen.mutate(organizer.id)}
            reconsideringId={
              reopen.isPending ? (reopen.variables ?? null) : null
            }
          />
        )}
        {tab === "all" && (
          <AllOrganizersTable organizers={rows} isFiltered={isFiltered} />
        )}
        {rows.length > 0 && (
          <TablePagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            itemCount={rows.length}
            onPageChange={setPage}
          />
        )}
      </OrganizerPanel>

      <CreateOrganizerDialog
        open={isCreating}
        onClose={closeCreate}
        isPending={create.isPending}
        error={create.error}
        onSubmit={(body) =>
          create.mutate(body, {
            onSuccess: (organizer) => {
              setCreated(organizer);
              closeCreate();
            },
          })
        }
      />
      <ApproveOrganizerDialog
        organizer={decision?.kind === "approve" ? decision.organizer : null}
        isPending={verify.isPending}
        error={verify.error?.message}
        onClose={closeDialog}
        onConfirm={() => {
          if (decision) {
            verify.mutate(decision.organizer.id, { onSuccess: closeDialog });
          }
        }}
      />
      <RejectOrganizerDialog
        organizer={decision?.kind === "reject" ? decision.organizer : null}
        isPending={reject.isPending}
        error={reject.error?.message}
        onClose={closeDialog}
        onConfirm={(reason) => {
          if (decision) {
            reject.mutate(
              { organizerId: decision.organizer.id, body: { reason } },
              { onSuccess: closeDialog },
            );
          }
        }}
      />
    </div>
  );
}
