"use client";

import { CalendarDays, MapPin } from "lucide-react";
import type { ReactNode } from "react";
import { Breadcrumb } from "@/src/core/ui";
import { useHasPermission } from "@/src/features/auth";
import { eventHref, EVENT_ROUTES } from "../routes";
import type { EventOverviewData } from "../types/event-manage.types";
import { unscheduledCount } from "../utils/event-attention";
import { formatEventDates, venueLine } from "../utils/event-display";
import {
  EVENT_SECTION_LABELS,
  EventSectionTabs,
  type EventSection,
} from "./EventSectionTabs";
import { EventStatusBadge } from "./EventStatusBadge";

/**
 * The top of every organizer page of an event: where you are, the title and status, when and
 * where, the buttons of this page (`actions`) and the section tabs. The breadcrumb starts where
 * the viewer came from: the organizer's "My events", or the admin's "Manage events" (an admin
 * has no events of their own).
 */
export function EventPageHeader({
  overview,
  current,
  actions,
}: {
  overview: EventOverviewData;
  /** The tab of the page being shown. */
  current: EventSection;
  actions?: ReactNode;
}) {
  const { event } = overview;
  const isOrganizer = useHasPermission("EVENT_MANAGE_OWN");
  const home = isOrganizer
    ? { label: "My events", href: EVENT_ROUTES.list }
    : { label: "Manage events", href: EVENT_ROUTES.manage };

  return (
    <header className="space-y-3.5">
      <Breadcrumb
        items={[
          home,
          current === "overview"
            ? { label: event.title }
            : { label: event.title, href: eventHref(event.id) },
          ...(current === "overview"
            ? []
            : [{ label: EVENT_SECTION_LABELS[current] }]),
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
        {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
      </div>
      <EventSectionTabs
        eventId={event.id}
        current={current}
        counts={{
          sessions: event.sessions.total,
          unscheduled: unscheduledCount(overview),
          speakers: overview.speakerCount,
          halls: overview.hallCount,
          attendees: event.registered,
        }}
      />
    </header>
  );
}
