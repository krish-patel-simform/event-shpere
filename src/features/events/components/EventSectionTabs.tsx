import Link from "next/link";
import { cn } from "@/src/core/ui";
import {
  eventAttendeesHref,
  eventHallsHref,
  eventHref,
  eventScheduleHref,
  eventSessionsHref,
  eventSpeakersHref,
} from "../routes";

/** The tabs of an event's organizer pages; the page you are on is marked. */
export type EventSection =
  "overview" | "sessions" | "schedule" | "speakers" | "halls" | "attendees";

type Section = {
  label: string;
  key: EventSection;
  href: string;
  count?: number;
  /** The count turns amber: something here needs the organizer. */
  warn?: boolean;
};

/** The page title shown last in the breadcrumb of a tab (the overview ends at the event). */
export const EVENT_SECTION_LABELS: Record<EventSection, string> = {
  overview: "Overview",
  sessions: "Sessions",
  schedule: "Schedule board",
  speakers: "Speakers",
  halls: "Halls",
  attendees: "Attendees",
};

/** The tabs every event page shares: Overview, Sessions, Schedule board, Speakers, Halls, Attendees. */
export function EventSectionTabs({
  eventId,
  current,
  counts,
}: {
  eventId: string;
  /** The tab of the page being shown. */
  current: EventSection;
  counts: {
    sessions: number;
    unscheduled: number;
    speakers: number;
    halls: number;
    attendees: number;
  };
}) {
  const sections: Section[] = [
    { label: "Overview", key: "overview", href: eventHref(eventId) },
    {
      label: "Sessions",
      key: "sessions",
      href: eventSessionsHref(eventId),
      count: counts.sessions,
    },
    {
      label: "Schedule board",
      key: "schedule",
      href: eventScheduleHref(eventId),
      count: counts.unscheduled || undefined,
      warn: true,
    },
    {
      label: "Speakers",
      key: "speakers",
      href: eventSpeakersHref(eventId),
      count: counts.speakers,
    },
    {
      label: "Halls",
      key: "halls",
      href: eventHallsHref(eventId),
      count: counts.halls,
    },
    {
      label: "Attendees",
      key: "attendees",
      href: eventAttendeesHref(eventId),
      count: counts.attendees,
    },
  ];

  return (
    <nav
      aria-label="Event sections"
      className="flex gap-6 overflow-x-auto border-b border-line"
    >
      {sections.map((section) => {
        const isCurrent = section.key === current;
        return (
          <Link
            key={section.key}
            href={section.href}
            aria-current={isCurrent ? "page" : undefined}
            className={cn(
              "inline-flex h-11 shrink-0 items-center gap-2 border-b-2 px-0.5 text-sm",
              isCurrent
                ? "border-brand font-semibold text-link"
                : "border-transparent text-muted hover:text-foreground",
            )}
          >
            {section.label}
            {section.count !== undefined && (
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs font-semibold",
                  section.warn
                    ? "bg-warning-soft text-warning"
                    : "bg-surface-subtle text-muted",
                )}
              >
                {section.count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
