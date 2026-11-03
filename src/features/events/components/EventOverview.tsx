"use client";

import { CalendarDays, ExternalLink, MapPin, Pencil } from "lucide-react";
import Link from "next/link";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { Alert, Breadcrumb, Button, buttonStyles } from "@/src/core/ui";
import { useGetEventOverview } from "../hooks/useGetEventOverview";
import { eventEditHref, EVENT_ROUTES, publicEventHref } from "../routes";
import type { EventOverviewData } from "../types/event-manage.types";
import { getAttentionItems, unscheduledCount } from "../utils/event-attention";
import {
  formatEventDates,
  isEditable,
  venueLine,
} from "../utils/event-display";
import { getPublishChecklist } from "../utils/publish-checklist";
import {
  AttentionCard,
  DetailsCard,
  KpiGrid,
  PublishChecklistCard,
  RegistrationProgressCard,
} from "./EventOverviewCards";
import { EventSectionTabs } from "./EventSectionTabs";
import { EventStatusBadge } from "./EventStatusBadge";

/**
 * The organizer's page for one event, loaded from GET /api/events/[id]: its status and figures,
 * what is left before a draft can be published, what a published event needs attention for, and
 * its details. Publishing, cancelling and deleting come with their endpoints.
 */
export function EventOverview({ eventId }: { eventId: string }) {
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

  return <OverviewPage overview={overview.data} />;
}

/** The overview of one loaded event. */
function OverviewPage({ overview }: { overview: EventOverviewData }) {
  const { event } = overview;
  const editable = isEditable(event.status);
  const checklist = getPublishChecklist({
    hasVenue: event.venue !== null,
    hallCount: overview.hallCount,
    content: overview.content,
    sessions: event.sessions,
  });

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="space-y-3.5">
        <Breadcrumb
          items={[
            { label: "My events", href: EVENT_ROUTES.list },
            { label: event.title },
          ]}
        />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold">{event.title}</h1>
              <EventStatusBadge status={event.status} />
            </div>
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays aria-hidden="true" className="size-4" />
                {formatEventDates(event.startAt, event.endAt, event.timezone, {
                  weekday: true,
                })}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin aria-hidden="true" className="size-4" />
                {venueLine(event)}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Link
              href={publicEventHref(event.slug)}
              className={buttonStyles({ variant: "secondary" })}
            >
              <ExternalLink aria-hidden="true" className="size-4" />
              View public page
            </Link>
            {editable && (
              <Link
                href={eventEditHref(event.id)}
                className={buttonStyles({ variant: "primary" })}
              >
                <Pencil aria-hidden="true" className="size-4" />
                Edit event
              </Link>
            )}
          </div>
        </div>
        <EventSectionTabs
          eventId={event.id}
          counts={{
            sessions: event.sessions.total,
            unscheduled: unscheduledCount(overview),
            speakers: overview.speakerCount,
            halls: overview.hallCount,
            attendees: event.registered,
          }}
        />
      </header>

      {event.status === "cancelled" && (
        <Alert tone="error" title="This event is cancelled">
          Registration is closed, and the event page shows a cancelled banner.
        </Alert>
      )}
      {event.status === "completed" && (
        <Alert tone="info" title="This event has ended">
          A completed event is read-only.
        </Alert>
      )}

      <KpiGrid overview={overview} />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-5">
          {event.status === "draft" && (
            <PublishChecklistCard checklist={checklist} />
          )}
          {event.status === "published" && (
            <>
              <AttentionCard items={getAttentionItems(overview)} />
              <RegistrationProgressCard overview={overview} />
            </>
          )}
          {event.status === "completed" && (
            <RegistrationProgressCard overview={overview} />
          )}
        </div>
        <div className="space-y-5">
          <DetailsCard
            overview={overview}
            editHref={editable ? eventEditHref(event.id) : null}
          />
        </div>
      </div>
    </div>
  );
}
