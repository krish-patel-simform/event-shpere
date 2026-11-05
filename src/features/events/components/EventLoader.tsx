"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { Alert, Button, buttonStyles } from "@/src/core/ui";
import { useGetEventOverview } from "../hooks/useGetEventOverview";
import { EVENT_ROUTES } from "../routes";
import type { EventOverviewData } from "../types/event-manage.types";

/**
 * Loads one event for an organizer page and shows the skeleton, the "not found" or the error
 * message while it is not there. Every page of an event (overview, sessions) starts with it, so
 * they all fail and wait the same way; `children` gets the loaded event.
 */
export function EventLoader({
  eventId,
  children,
}: {
  eventId: string;
  children: (overview: EventOverviewData) => ReactNode;
}) {
  const overview = useGetEventOverview(eventId);

  if (overview.isPending) {
    return (
      <div
        role="status"
        aria-label="Loading event"
        className="mx-auto max-w-6xl animate-pulse space-y-4 motion-reduce:animate-none"
      >
        <div className="h-8 w-72 rounded bg-surface-subtle" />
        <div className="h-4 w-96 max-w-full rounded bg-surface-subtle" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((card) => (
            <div key={card} className="h-24 rounded-lg bg-surface-subtle" />
          ))}
        </div>
        <div className="h-64 rounded-lg bg-surface-subtle" />
      </div>
    );
  }

  if (overview.isError) {
    // A 404 is final (not the organizer's event, or deleted); anything else may pass.
    const notFound =
      overview.error instanceof ApiError && overview.error.status === 404;
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Alert
          tone="error"
          title={notFound ? "Event not found" : "We couldn't load this event"}
        >
          {notFound
            ? "It may have been deleted, or it is not one of your events."
            : overview.error.message}
        </Alert>
        <div className="flex flex-wrap gap-2.5">
          {!notFound && (
            <Button variant="secondary" onClick={() => void overview.refetch()}>
              Try again
            </Button>
          )}
          <Link
            href={EVENT_ROUTES.list}
            className={buttonStyles({ variant: "secondary" })}
          >
            Back to My events
          </Link>
        </div>
      </div>
    );
  }

  return children(overview.data);
}
