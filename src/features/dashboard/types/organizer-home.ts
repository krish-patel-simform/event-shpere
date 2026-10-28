// What an approved organizer's dashboard home shows. Sample data
// (utils/organizer-home.sample.ts) in these shapes until the events / registrations endpoints
// exist. All dates are ISO.

export type OrganizerKpis = {
  publishedEvents: number;
  draftEvents: number;
  completedEvents: number;
  registrations: number;
  registrationsThisWeek: number;
  /** Seats taken across published events, in percent (68 = 68 %). */
  seatsFilledPct: number;
  /** Null until a completed event has ratings. */
  averageSessionRating: number | null;
};

export type DailyRegistrations = {
  /** ISO date (yyyy-mm-dd). */
  date: string;
  count: number;
};

export type DailyRegistrationsData = {
  /** Oldest day first. */
  days: DailyRegistrations[];
  /** Change vs the previous period of the same length, in percent (18 = +18 %). */
  changePct: number;
};

export type ReadinessItem = {
  label: string;
  done: boolean;
  /** What is missing, for an item that is not done. */
  detail?: string;
  /** Where to fix it, for an item that is not done. */
  action?: { label: string; href: string };
};

/** The draft event closest to being published, and what it still needs. */
export type PublishReadiness = {
  eventSlug: string;
  eventTitle: string;
  items: ReadinessItem[];
};

export type OrganizerEventStatus =
  "draft" | "published" | "completed" | "cancelled";

export type OrganizerEventRegistrations =
  /** An open event: seats taken out of capacity. */
  | { kind: "seats"; registered: number; capacity: number }
  /** Anything else, in words: "Not open yet", "64 notified", "412 attended". */
  | { kind: "text"; text: string };

export type OrganizerEvent = {
  id: string;
  slug: string;
  title: string;
  startsAt: string;
  endsAt: string;
  city: string;
  /** Ticket price in rupees; 0 = free. */
  priceInr: number;
  status: OrganizerEventStatus;
  registrations: OrganizerEventRegistrations;
  sessionCount: number;
};

export type AttentionKind = "almost_full" | "invite" | "content" | "polls";

/** One thing that needs the organizer's attention today. */
export type AttentionItem = {
  id: string;
  kind: AttentionKind;
  /** Bold part of the sentence (a person, session or event). */
  subject?: string;
  message: string;
  action?: { label: string; href: string };
};

export type OrganizerHomeData = {
  kpis: OrganizerKpis;
  dailyRegistrations: DailyRegistrationsData;
  readiness: PublishReadiness | null;
  events: OrganizerEvent[];
  attention: AttentionItem[];
};
