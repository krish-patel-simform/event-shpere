import { formatDate } from "@/src/core/format/format-date";
import { eventScheduleHref, eventSessionsHref } from "../routes";
import type { EventOverviewData } from "../types/event-manage.types";
import { plural } from "./event-display";

export type AttentionItem = {
  key: string;
  tone: "warning" | "info" | "success";
  title: string;
  description: string;
  /** Where to deal with it; none for a note that needs nothing from the organizer. */
  action?: { label: string; href: string };
};

/** Sessions that are neither on the schedule nor cancelled, so attendees cannot see them. */
export function unscheduledCount({ event }: EventOverviewData): number {
  const { total, scheduled, cancelled } = event.sessions;
  return Math.max(total - scheduled - cancelled, 0);
}

/**
 * What a published event's overview asks the organizer to look at: sessions not on the schedule,
 * sessions that are full, and (always last) that the event is published. Empty for other statuses.
 */
export function getAttentionItems(
  overview: EventOverviewData,
): AttentionItem[] {
  if (overview.event.status !== "published") return [];

  const items: AttentionItem[] = [];
  const unscheduled = unscheduledCount(overview);
  if (unscheduled > 0) {
    items.push({
      key: "unscheduled",
      tone: "warning",
      title: `${plural(unscheduled, "session")} ${unscheduled === 1 ? "is" : "are"} not scheduled`,
      description: "Attendees can’t see or book them yet.",
      action: {
        label: "Open schedule board",
        href: eventScheduleHref(overview.event.id),
      },
    });
  }
  for (const session of overview.fullSessions) {
    items.push({
      key: `full-${session.id}`,
      tone: "info",
      title: `“${session.title}” is full`,
      description: `${session.seats} of ${session.seats} seats booked. Raise the session capacity to let more people book.`,
      action: {
        label: "Review sessions",
        href: eventSessionsHref(overview.event.id),
      },
    });
  }
  items.push({
    key: "published",
    tone: "success",
    title: "Event is published",
    description: overview.publishedAt
      ? `Registration is open · published ${formatDate(overview.publishedAt)}.`
      : "Registration is open.",
  });
  return items;
}
