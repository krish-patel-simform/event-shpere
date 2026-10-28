import type { HomeNotification } from "./home-shared";

// What an attendee's dashboard home shows. Sample data (utils/attendee-home.sample.ts) in these
// shapes until the registrations / agenda endpoints exist. All dates are ISO date-times.

export type AttendeeNextEvent = {
  slug: string;
  title: string;
  startsAt: string;
  endsAt: string;
  venue: string;
  city: string;
  sessionsBooked: number;
};

export type AttendeeEvent = {
  id: string;
  slug: string;
  title: string;
  startsAt: string;
  endsAt: string;
  city: string;
  /** Ticket price in rupees; 0 = free. */
  priceInr: number;
  sessionsBooked: number;
  status: "registered" | "cancelled";
  /** When the organizer cancelled the event; set when status is "cancelled". */
  cancelledAt: string | null;
};

export type ScheduleSpeaker = { name: string; slug: string };

export type AttendeeScheduleEntry = {
  id: string;
  /** A "break" is free time between two booked sessions. */
  kind: "session" | "break";
  title: string;
  startsAt: string;
  endsAt: string;
  location: string | null;
  speakers: ScheduleSpeaker[];
};

/** The attendee's booked sessions for one day of one event. */
export type AttendeeSchedule = {
  eventSlug: string;
  eventTitle: string;
  /** Any moment of the day shown. */
  day: string;
  entries: AttendeeScheduleEntry[];
};

/** A finished session the attendee has not rated yet. */
export type AttendeeRatingPrompt = {
  sessionTitle: string;
  eventTitle: string;
  eventDate: string;
};

export type AttendeeStats = {
  upcomingEvents: number;
  sessionsBooked: number;
  sessionsToRate: number;
  pollsVoted: number;
};

export type AttendeeHomeData = {
  firstName: string;
  /** The soonest registered event; null when there is none. */
  nextEvent: AttendeeNextEvent | null;
  stats: AttendeeStats;
  events: AttendeeEvent[];
  schedule: AttendeeSchedule | null;
  ratingPrompt: AttendeeRatingPrompt | null;
  notifications: HomeNotification[];
};
