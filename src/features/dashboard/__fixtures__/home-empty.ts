import type { AttendeeHomeData } from "../types/attendee-home";
import type { OrganizerHomeData } from "../types/organizer-home";
import type { SpeakerHomeData } from "../types/speaker-home";

// A brand-new account on each role's home screen: every list empty, every number zero. For tests
// of the empty states only; the screens' real sample data lives in utils/*.sample.ts.

export const EMPTY_ATTENDEE_HOME: AttendeeHomeData = {
  firstName: "Rahul",
  nextEvent: null,
  stats: {
    upcomingEvents: 0,
    sessionsBooked: 0,
    sessionsToRate: 0,
    pollsVoted: 0,
  },
  events: [],
  schedule: null,
  ratingPrompt: null,
  notifications: [],
};

export const EMPTY_SPEAKER_HOME: SpeakerHomeData = {
  firstName: "Ananya",
  nextSession: null,
  stats: {
    confirmedSessions: 0,
    sessionsUnderReview: 0,
    totalRegistrations: 0,
    registrationsThisWeek: 0,
    averageRating: null,
    ratingCount: 0,
    openTodos: 0,
    nextTodoDueAt: null,
  },
  registrationTrend: { points: [], note: null },
  sessions: [],
  todos: [],
  feedback: null,
  notifications: [],
};

export const EMPTY_ORGANIZER_HOME: OrganizerHomeData = {
  kpis: {
    publishedEvents: 0,
    draftEvents: 0,
    completedEvents: 0,
    registrations: 0,
    registrationsThisWeek: 0,
    seatsFilledPct: 0,
    averageSessionRating: null,
  },
  dailyRegistrations: { days: [], changePct: 0 },
  readiness: null,
  events: [],
  attention: [],
};
