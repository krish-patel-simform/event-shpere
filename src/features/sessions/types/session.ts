import type {
  SESSION_FORMATS,
  SESSION_LEVELS,
  SESSION_STATUSES,
  SESSION_TRACKS,
} from "../constants";

export type SessionFormat = (typeof SESSION_FORMATS)[number];
export type SessionLevel = (typeof SESSION_LEVELS)[number];
export type SessionTrack = (typeof SESSION_TRACKS)[number];
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export type SessionCoSpeaker = {
  name: string;
  role: string;
  /** `accepted` = they confirmed the invitation. */
  invitation: "accepted" | "invited";
};

export type SessionMaterial = {
  fileName: string;
  /** "PDF", "PPTX" ... shown in the file badge. */
  kind: string;
  sizeBytes: number;
  /** ISO date-time. */
  uploadedAt: string;
  /** Who can open the file. */
  visibility: "organizers" | "attendees";
};

export type SessionLogistics = {
  layout: string;
  checkIn: string;
  av: string;
  host: string;
};

/** New registrations on one day, oldest first, for the small bar chart. */
export type RegistrationDay = { date: string; count: number };

/**
 * One session of the signed-in speaker, as the list and the detail page show it. Sample data for
 * now; the API will return the same shape. Times are ISO date-times in UTC.
 */
export type SessionItem = {
  id: string;
  title: string;
  abstract: string;
  takeaways: readonly string[];
  format: SessionFormat;
  durationMinutes: number;
  track: SessionTrack;
  level: SessionLevel;
  status: SessionStatus;
  eventName: string;
  /** null until the organizers schedule it. */
  startsAt: string | null;
  endsAt: string | null;
  room: string | null;
  /** Seats taken and available; null when the session is not open for registration. */
  registrations: { registered: number; capacity: number } | null;
  /** Filled in once the session is over. */
  attended: number | null;
  /** Average attendee rating out of 5, once the session is over. */
  rating: number | null;
  /** ISO date-time of the last edit (shown for drafts). */
  updatedAt: string;
  materialsDueAt: string | null;
  materials: readonly SessionMaterial[];
  coSpeakers: readonly SessionCoSpeaker[];
  logistics: SessionLogistics | null;
  registrationTrend: readonly RegistrationDay[];
};
