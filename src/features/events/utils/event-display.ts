import type { Tab } from "@/src/core/ui";
import type {
  EventDisplayStatus,
  EventSort,
  EventTabKey,
} from "../schemas/event-manage.schemas";
import type { ManagedEvent } from "../types/event-manage.types";

//* Status, tabs and filters

/** The label and badge colour of each status. */
export const EVENT_STATUS_META: Record<
  EventDisplayStatus,
  { label: string; tone: "neutral" | "success" | "brand" | "danger" }
> = {
  draft: { label: "Draft", tone: "neutral" },
  published: { label: "Published", tone: "success" },
  completed: { label: "Completed", tone: "brand" },
  cancelled: { label: "Cancelled", tone: "danger" },
};

export const EVENT_TABS: readonly Tab<EventTabKey>[] = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "published", label: "Published" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

export const TAB_DESCRIPTIONS: Record<EventTabKey, string> = {
  all: "Every event you organise.",
  draft: "Only you can see these. Publish one to open it for registration.",
  published: "Public and open for registration.",
  completed: "These events have ended. They are read-only.",
  cancelled: "Registration is closed. The page stays visible with a banner.",
};

/** The search box and the sort select; the tab is kept next to them. */
export type EventFilters = { search: string; sort: EventSort };

export const DEFAULT_EVENT_FILTERS: EventFilters = {
  search: "",
  sort: "soonest",
};

export function isFiltering(tab: EventTabKey, filters: EventFilters): boolean {
  return tab !== "all" || filters.search.trim() !== "";
}

//* Dates and times, in the event's own time zone

const ZONE_NAMES: Record<string, string> = { "Asia/Kolkata": "IST" };

/** "IST" for India; any other zone shows its IANA name. */
export function zoneLabel(timezone: string): string {
  return ZONE_NAMES[timezone] ?? timezone;
}

function zonedParts(iso: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    weekday: get("weekday"),
    day: get("day"),
    month: get("month"),
    year: get("year"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

/**
 * "3 – 5 Dec 2026", or "14 Nov 2026" for a single day. With `weekday`: "Wed 3 – Fri 5 Dec 2026".
 * Built from parts, because Intl's own joiners differ between browsers and Node versions.
 */
export function formatEventDates(
  startAt: string,
  endAt: string,
  timezone: string,
  { weekday = false }: { weekday?: boolean } = {},
): string {
  const start = zonedParts(startAt, timezone);
  const end = zonedParts(endAt, timezone);
  const day = (p: typeof start) => (weekday ? `${p.weekday} ${p.day}` : p.day);
  const full = (p: typeof start) => `${day(p)} ${p.month} ${p.year}`;

  if (full(start) === full(end)) return full(start);
  if (start.month === end.month && start.year === end.year) {
    return `${day(start)} – ${day(end)} ${end.month} ${end.year}`;
  }
  if (start.year === end.year) {
    return `${day(start)} ${start.month} – ${full(end)}`;
  }
  return `${full(start)} – ${full(end)}`;
}

/** "09:00 – 18:00 IST": the first day's start to the last day's end. */
export function formatEventTimes(
  startAt: string,
  endAt: string,
  timezone: string,
): string {
  const start = zonedParts(startAt, timezone);
  const end = zonedParts(endAt, timezone);
  return `${start.hour}:${start.minute} – ${end.hour}:${end.minute} ${zoneLabel(timezone)}`;
}

/** The little date block in front of a title: { day: "03", month: "DEC" }. */
export function thumbDate(
  startAt: string,
  timezone: string,
): { day: string; month: string } {
  const { day, month } = zonedParts(startAt, timezone);
  return { day: day.padStart(2, "0"), month: month.toUpperCase() };
}

/** The date and time as the form's inputs want them: "2026-12-12" and "09:30", in the zone. */
export function toFormDateTime(
  iso: string,
  timezone: string,
): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

//* Other text

/** "Free" or "₹1,500" (the price is in paise). */
export function formatTicketPrice(paise: number): string {
  if (paise === 0) return "Free";
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: Number.isInteger(rupees) ? 0 : 2,
  }).format(rupees);
}

/** 0–100, for a progress bar. No capacity (no limit) is 0. */
export function fillPercent(
  registered: number,
  capacity: number | null,
): number {
  if (!capacity) return 0;
  return Math.min(100, Math.round((registered / capacity) * 100));
}

/** A bar turns amber from this share of the seats. */
export const ALMOST_FULL_PERCENT = 90;

export function venueLine(event: Pick<ManagedEvent, "venue">): string {
  return event.venue
    ? `${event.venue.name}, ${event.venue.city}`
    : "No venue chosen yet";
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** What the Registrations column shows: a seats bar, or one line of text. */
export type RegistrationsCell =
  | { kind: "bar"; registered: number; capacity: number }
  | { kind: "text"; text: string };

export function registrationsCell(event: ManagedEvent): RegistrationsCell {
  if (event.status === "draft") {
    return { kind: "text", text: "Opens when published" };
  }
  if (event.status === "cancelled") {
    return {
      kind: "text",
      text:
        event.cancelledRegistrations > 0
          ? `${plural(event.cancelledRegistrations, "registration")} cancelled`
          : "No registrations",
    };
  }
  if (event.capacity === null) {
    return { kind: "text", text: `${event.registered} registered` };
  }
  return {
    kind: "bar",
    registered: event.registered,
    capacity: event.capacity,
  };
}

/** What the Sessions column shows under the count; `warn` when nothing is scheduled yet. */
export function sessionsCell(event: ManagedEvent): {
  primary: string;
  secondary: string;
  warn: boolean;
} {
  const { total, scheduled, cancelled } = event.sessions;
  return {
    primary: plural(total, "session"),
    secondary:
      total > 0 && cancelled === total
        ? "All cancelled"
        : `${scheduled} scheduled`,
    warn: event.status === "draft" && total > 0 && scheduled === 0,
  };
}

/** A card turns amber when this many seats or fewer are left. */
export const FEW_SEATS_LEFT = 20;

/** The seats badge on a public event card: the text and its colour. null = no seat limit. */
export function seatsLeftBadge(seatsLeft: number | null): {
  text: string;
  tone: "success" | "warning" | "neutral";
} {
  if (seatsLeft === null) return { text: "No seat limit", tone: "neutral" };
  if (seatsLeft === 0) return { text: "Sold out", tone: "neutral" };
  return {
    text: `${plural(seatsLeft, "seat")} left`,
    tone: seatsLeft <= FEW_SEATS_LEFT ? "warning" : "success",
  };
}

/** Whether the organizer can still change the event: not once it is completed or cancelled. */
export function isEditable(status: EventDisplayStatus): boolean {
  return status === "draft" || status === "published";
}
