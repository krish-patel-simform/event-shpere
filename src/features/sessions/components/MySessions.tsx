"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Alert, Button, buttonStyles, tabId, Tabs } from "@/src/core/ui";
import { SESSION_ROUTES } from "../routes";
import type { SessionItem } from "../types/session";
import {
  applySessionFilters,
  countByTab,
  DEFAULT_SESSION_FILTERS,
  eventNames,
  isFiltering,
  SESSION_TABS,
  type SessionFilters as Filters,
} from "../utils/session-display";
import { SAMPLE_NOW, SAMPLE_SESSIONS } from "../utils/sessions.sample";
import { SampleDataNotice } from "./SampleDataNotice";
import { SessionFilters } from "./SessionFilters";
import { SessionListSkeleton } from "./SessionListSkeleton";
import { SessionsTable } from "./SessionsTable";

const PANEL_ID = "sessions-panel";
const DEFAULT_PAGE_SIZE = 10;

type MySessionsProps = {
  /** The speaker's sessions. Sample data until the API exists. */
  sessions?: readonly SessionItem[];
  /** The current time (ISO), to split upcoming from past. A fixed default keeps tests stable. */
  now?: string;
  /** What the list shows: the table, a loading skeleton, or an error with "Try again". */
  state?: "ready" | "loading" | "error";
  /** Shown in the error state; the "Try again" button appears when this is given. */
  onRetry?: () => void;
  pageSize?: number;
};

/**
 * The speaker's "My sessions" page: their talks, workshops and panels across events, filtered by
 * status tab, search, event and format, sorted and paged. Runs on sample data (nothing is loaded
 * from a server yet); the data, the time and the state are props so the API can replace them.
 */
export function MySessions({
  sessions = SAMPLE_SESSIONS,
  now = SAMPLE_NOW,
  state = "ready",
  onRetry,
  pageSize = DEFAULT_PAGE_SIZE,
}: MySessionsProps) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_SESSION_FILTERS);
  const [page, setPage] = useState(1);

  const counts = useMemo(() => countByTab(sessions, now), [sessions, now]);
  const events = useMemo(() => eventNames(sessions), [sessions]);
  const matches = useMemo(
    () => applySessionFilters(sessions, filters, now),
    [sessions, filters, now],
  );
  const visible = matches.slice((page - 1) * pageSize, page * pageSize);

  // A new filter or search starts again from the first page.
  const change = (patch: Partial<Filters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  };
  const clearFilters = () => {
    setFilters((current) => ({
      ...DEFAULT_SESSION_FILTERS,
      sort: current.sort,
    }));
    setPage(1);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">My sessions</h1>
          <p className="text-muted">
            Talks, workshops and panels you&apos;re presenting across events.
          </p>
        </div>
        <Link
          href={SESSION_ROUTES.create}
          className={buttonStyles({ variant: "primary" })}
        >
          <Plus aria-hidden="true" className="size-4" />
          Submit a session
        </Link>
      </header>

      <SampleDataNotice />

      <Tabs
        label="Filter sessions by status"
        tabs={SESSION_TABS}
        counts={state === "ready" ? counts : {}}
        value={filters.tab}
        onChange={(tab) => change({ tab })}
        panelId={PANEL_ID}
      />

      <SessionFilters filters={filters} events={events} onChange={change} />

      <div
        role="tabpanel"
        id={PANEL_ID}
        aria-labelledby={tabId(PANEL_ID, filters.tab)}
        className="overflow-hidden rounded-lg border border-line bg-surface"
      >
        {state === "loading" ? (
          <SessionListSkeleton />
        ) : state === "error" ? (
          <div className="p-5">
            <Alert tone="error" title="We couldn't load your sessions">
              Check your connection and try again.
              {onRetry && (
                <Button variant="secondary" onClick={onRetry} className="mt-3">
                  Try again
                </Button>
              )}
            </Alert>
          </div>
        ) : (
          <SessionsTable
            sessions={visible}
            total={matches.length}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            isFiltered={isFiltering(filters)}
            onClearFilters={clearFilters}
          />
        )}
      </div>
    </div>
  );
}
