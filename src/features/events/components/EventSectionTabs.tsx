import Link from "next/link";
import { cn } from "@/src/core/ui";
import { eventHref } from "../routes";

type Section = {
  label: string;
  count?: number;
  /** The count turns amber: something here needs the organizer. */
  warn?: boolean;
  /** Its page exists. The others are listed but not links yet. */
  built: boolean;
};

/**
 * The tabs every event page shares: Overview, Sessions, Schedule board, Speakers, Halls,
 * Attendees. Only Overview has a page so far; the rest show as disabled instead of linking to
 * pages that do not exist.
 */
export function EventSectionTabs({
  eventId,
  counts,
}: {
  eventId: string;
  counts: {
    sessions: number;
    unscheduled: number;
    speakers: number;
    halls: number;
    attendees: number;
  };
}) {
  const sections: Section[] = [
    { label: "Overview", built: true },
    { label: "Sessions", count: counts.sessions, built: false },
    {
      label: "Schedule board",
      count: counts.unscheduled || undefined,
      warn: true,
      built: false,
    },
    { label: "Speakers", count: counts.speakers, built: false },
    { label: "Halls", count: counts.halls, built: false },
    { label: "Attendees", count: counts.attendees, built: false },
  ];

  return (
    <nav
      aria-label="Event sections"
      className="flex gap-6 overflow-x-auto border-b border-line"
    >
      {sections.map((section) => {
        const className =
          "inline-flex h-11 shrink-0 items-center gap-2 border-b-2 px-0.5 text-sm";
        const count = section.count !== undefined && (
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
        );

        if (!section.built) {
          return (
            <span
              key={section.label}
              aria-disabled="true"
              title="Coming soon"
              className={cn(
                className,
                "cursor-not-allowed border-transparent text-muted",
              )}
            >
              {section.label}
              {count}
            </span>
          );
        }
        return (
          <Link
            key={section.label}
            href={eventHref(eventId)}
            aria-current="page"
            className={cn(className, "border-brand font-semibold text-link")}
          >
            {section.label}
            {count}
          </Link>
        );
      })}
    </nav>
  );
}
