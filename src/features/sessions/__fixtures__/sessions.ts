import type { SessionItem } from "../types/session";

/** The "current time" of the tests: after the past sessions, before the upcoming ones. */
export const NOW = "2026-06-01T12:00:00.000Z";

const base: SessionItem = {
  id: "s-base",
  title: "Base",
  abstract: "An abstract.",
  takeaways: [],
  format: "talk",
  durationMinutes: 30,
  track: "frontend-architecture",
  level: "intermediate",
  status: "confirmed",
  eventName: "Summit 2026",
  startsAt: "2026-06-10T09:00:00.000Z",
  endsAt: "2026-06-10T09:30:00.000Z",
  room: "Hall B",
  registrations: { registered: 50, capacity: 100 },
  attended: null,
  rating: null,
  updatedAt: "2026-05-01T10:00:00.000Z",
  materialsDueAt: null,
  materials: [],
  coSpeakers: [],
  logistics: null,
  registrationTrend: [],
};

/** Confirmed, soon, almost full, with everything the detail page can show. */
export const scalingTalk: SessionItem = {
  ...base,
  id: "s-scaling",
  title: "Scaling Next.js in Production",
  abstract: "How we scaled a Next.js app to hundreds of routes.",
  takeaways: ["Pick the rendering mode per route", "Cache with intent"],
  durationMinutes: 45,
  startsAt: "2026-06-10T09:00:00.000Z",
  endsAt: "2026-06-10T09:45:00.000Z",
  registrations: { registered: 95, capacity: 100 },
  materialsDueAt: "2026-06-01T00:00:00.000Z",
  materials: [
    {
      fileName: "outline.pdf",
      kind: "PDF",
      sizeBytes: 1_887_436,
      uploadedAt: "2026-05-14T10:00:00.000Z",
      visibility: "organizers",
    },
  ],
  coSpeakers: [
    {
      name: "Vikram Mehta",
      role: "Engineering Manager",
      invitation: "accepted",
    },
    { name: "Sara Khan", role: "Staff Engineer", invitation: "invited" },
  ],
  logistics: {
    layout: "Theatre, 100 seats",
    checkIn: "08:30 at the Green Room",
    av: "Projector",
    host: "Priya Nair",
  },
  registrationTrend: [
    { date: "2026-05-24T00:00:00.000Z", count: 10 },
    { date: "2026-05-25T00:00:00.000Z", count: 20 },
    { date: "2026-05-26T00:00:00.000Z", count: 5 },
  ],
};

/** Confirmed, later than the talk, a workshop at another event. */
export const zodWorkshop: SessionItem = {
  ...base,
  id: "s-zod",
  title: "Type-safe APIs with Zod",
  format: "workshop",
  durationMinutes: 120,
  track: "developer-tooling",
  eventName: "Meetup",
  startsAt: "2026-07-02T09:00:00.000Z",
  endsAt: "2026-07-02T11:00:00.000Z",
  room: "Lab 3",
  registrations: { registered: 10, capacity: 40 },
};

/** Not scheduled yet. */
export const pwaTalk: SessionItem = {
  ...base,
  id: "s-pwa",
  title: "Offline-first apps with PWAs",
  track: "mobile-web",
  status: "under_review",
  startsAt: null,
  endsAt: null,
  room: null,
  registrations: null,
  updatedAt: "2026-05-20T10:00:00.000Z",
};

export const sentryDraft: SessionItem = {
  ...base,
  id: "s-sentry",
  title: "Observability with Sentry",
  track: "developer-tooling",
  status: "draft",
  eventName: "Meetup",
  startsAt: null,
  endsAt: null,
  room: null,
  registrations: null,
  updatedAt: "2026-05-25T10:00:00.000Z",
};

/** Marked completed, with attendance and a rating. */
export const reduxTalk: SessionItem = {
  ...base,
  id: "s-redux",
  title: "State with Redux Toolkit",
  status: "completed",
  eventName: "Frontend Day 2025",
  startsAt: "2025-06-14T09:00:00.000Z",
  endsAt: "2025-06-14T09:45:00.000Z",
  room: "Room 2",
  registrations: null,
  attended: 412,
  rating: 4.7,
};

/** Still "confirmed" in the data, but it ended before NOW: counts as past. */
export const endedPanel: SessionItem = {
  ...base,
  id: "s-panel",
  title: "Panel: Frontend Tooling",
  format: "panel",
  durationMinutes: 60,
  startsAt: "2026-05-20T09:00:00.000Z",
  endsAt: "2026-05-20T10:00:00.000Z",
  registrations: { registered: 200, capacity: 500 },
};

export const allSessions: readonly SessionItem[] = [
  zodWorkshop,
  reduxTalk,
  sentryDraft,
  scalingTalk,
  pwaTalk,
  endedPanel,
];
