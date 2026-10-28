import type { HomeNotification } from "./home-shared";

// What a speaker's dashboard home shows. Sample data (utils/speaker-home.sample.ts) in these
// shapes until the sessions / registrations endpoints exist. All dates are ISO date-times.

export type SpeakerNextSession = {
  id: string;
  title: string;
  startsAt: string;
  location: string;
  seatsFilled: number;
  seatsTotal: number;
};

export type SpeakerStats = {
  confirmedSessions: number;
  sessionsUnderReview: number;
  totalRegistrations: number;
  registrationsThisWeek: number;
  /** Null until a session has been rated. */
  averageRating: number | null;
  ratingCount: number;
  openTodos: number;
  /** ISO date of the earliest open to-do; null when nothing is open. */
  nextTodoDueAt: string | null;
};

/** Registrations across the speaker's sessions on one day (cumulative). */
export type RegistrationPoint = {
  /** ISO date (yyyy-mm-dd). */
  date: string;
  total: number;
};

export type RegistrationTrend = {
  /** Oldest day first. */
  points: RegistrationPoint[];
  /** Something that explains a jump in the line (e.g. the line-up announcement). */
  note: { date: string; text: string } | null;
};

export type SpeakerSessionStatus = "confirmed" | "under_review" | "declined";

export type SpeakerSession = {
  id: string;
  title: string;
  /** Null while the session has not been scheduled yet. */
  startsAt: string | null;
  endsAt: string | null;
  room: string | null;
  format: "Talk" | "Workshop" | "Panel";
  /** Short extra line: "with Vikram Mehta", "submitted 14 Oct". */
  note: string | null;
  seatsFilled: number | null;
  seatsTotal: number | null;
  status: SpeakerSessionStatus;
};

export type SpeakerTodo = {
  id: string;
  title: string;
  /** Second line (the session it belongs to). */
  detail: string | null;
  dueAt: string | null;
  done: boolean;
  action: { label: string; href: string } | null;
};

/** Ratings for one finished session. `breakdown` is the share of each star count, in percent. */
export type SpeakerFeedback = {
  sessionTitle: string;
  eventTitle: string;
  average: number;
  ratingCount: number;
  breakdown: Record<1 | 2 | 3 | 4 | 5, number>;
  quote: { text: string; rating: number } | null;
};

export type SpeakerHomeData = {
  firstName: string;
  nextSession: SpeakerNextSession | null;
  stats: SpeakerStats;
  registrationTrend: RegistrationTrend;
  sessions: SpeakerSession[];
  todos: SpeakerTodo[];
  feedback: SpeakerFeedback | null;
  notifications: HomeNotification[];
};
