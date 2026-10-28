import type { SessionItem } from "../types/session";

// Sample data: the sessions API does not exist yet. The screens take their data as props with
// these as the default, so wiring the API later replaces the default, not the screens.

/** The "current time" of the sample screens: a fixed value keeps the upcoming/past split stable. */
export const SAMPLE_NOW = "2026-10-27T09:00:00.000Z";

const SUMMIT = "Product Engineering Summit";
const MEETUP = "Web Dev Meetup – Nov 2026";

const LOGISTICS_HALL_B = {
  layout: "Theatre, 300 seats",
  checkIn: "09:30 at the Green Room",
  av: "Projector, HDMI, lapel mic",
  host: "Priya Nair",
} as const;

export const SAMPLE_SESSIONS: readonly SessionItem[] = [
  {
    id: "a1f3c9d2-1b7e-4c55-9a10-5d2f6e8b0a01",
    title: "Scaling Next.js Applications: Lessons from Production",
    abstract:
      "Moving a Next.js app from a handful of pages to hundreds of routes and millions of monthly visits changes almost every decision you made at the start. This talk walks through the rendering, caching and deployment choices our team revisited along the way, and what we would do differently.",
    takeaways: [
      "When to choose static, server or streaming rendering for a route",
      "Practical cache invalidation strategies for content-heavy pages",
      "How to monitor and debug production issues with error tracking",
    ],
    format: "talk",
    durationMinutes: 45,
    track: "frontend-architecture",
    level: "intermediate",
    status: "confirmed",
    eventName: SUMMIT,
    startsAt: "2026-12-04T04:30:00.000Z",
    endsAt: "2026-12-04T05:15:00.000Z",
    room: "Hall B",
    registrations: { registered: 248, capacity: 300 },
    attended: null,
    rating: null,
    updatedAt: "2026-10-14T10:00:00.000Z",
    materialsDueAt: "2026-11-25T00:00:00.000Z",
    materials: [
      {
        fileName: "nextjs-scaling-outline-v2.pdf",
        kind: "PDF",
        sizeBytes: 1_887_436,
        uploadedAt: "2026-10-14T10:00:00.000Z",
        visibility: "organizers",
      },
    ],
    coSpeakers: [
      {
        name: "Vikram Mehta",
        role: "Engineering Manager",
        invitation: "accepted",
      },
    ],
    logistics: LOGISTICS_HALL_B,
    registrationTrend: [
      { date: "2026-10-14T00:00:00.000Z", count: 12 },
      { date: "2026-10-15T00:00:00.000Z", count: 18 },
      { date: "2026-10-16T00:00:00.000Z", count: 9 },
      { date: "2026-10-17T00:00:00.000Z", count: 22 },
      { date: "2026-10-18T00:00:00.000Z", count: 15 },
      { date: "2026-10-19T00:00:00.000Z", count: 31 },
      { date: "2026-10-20T00:00:00.000Z", count: 26 },
    ],
  },
  {
    id: "a1f3c9d2-1b7e-4c55-9a10-5d2f6e8b0a02",
    title: "Hands-on: Type-safe APIs with TypeScript and Zod",
    abstract:
      "A two-hour workshop where attendees build a small REST API and share one set of Zod schemas between the server and the client, so a change to a field is caught by the compiler on both sides.",
    takeaways: [
      "Deriving request and response types from one schema",
      "Turning validation errors into messages a form can show",
    ],
    format: "workshop",
    durationMinutes: 120,
    track: "developer-tooling",
    level: "intermediate",
    status: "confirmed",
    eventName: SUMMIT,
    startsAt: "2026-12-04T08:30:00.000Z",
    endsAt: "2026-12-04T10:30:00.000Z",
    room: "Lab 3",
    registrations: { registered: 38, capacity: 40 },
    attended: null,
    rating: null,
    updatedAt: "2026-10-09T10:00:00.000Z",
    materialsDueAt: "2026-11-27T00:00:00.000Z",
    materials: [],
    coSpeakers: [],
    logistics: {
      layout: "Classroom, 40 seats",
      checkIn: "13:30 at Lab 3",
      av: "Projector, HDMI",
      host: "Priya Nair",
    },
    registrationTrend: [
      { date: "2026-10-14T00:00:00.000Z", count: 3 },
      { date: "2026-10-15T00:00:00.000Z", count: 5 },
      { date: "2026-10-16T00:00:00.000Z", count: 4 },
      { date: "2026-10-17T00:00:00.000Z", count: 6 },
      { date: "2026-10-18T00:00:00.000Z", count: 2 },
      { date: "2026-10-19T00:00:00.000Z", count: 7 },
      { date: "2026-10-20T00:00:00.000Z", count: 3 },
    ],
  },
  {
    id: "a1f3c9d2-1b7e-4c55-9a10-5d2f6e8b0a03",
    title: "Panel: The Future of Frontend Tooling",
    abstract:
      "Four practitioners discuss where build tools, type checkers and test runners are heading, and what that means for teams choosing a stack today.",
    takeaways: [],
    format: "panel",
    durationMinutes: 60,
    track: "developer-tooling",
    level: "beginner",
    status: "confirmed",
    eventName: SUMMIT,
    startsAt: "2026-12-05T06:00:00.000Z",
    endsAt: "2026-12-05T07:00:00.000Z",
    room: "Main Hall",
    registrations: { registered: 356, capacity: 500 },
    attended: null,
    rating: null,
    updatedAt: "2026-10-01T10:00:00.000Z",
    materialsDueAt: null,
    materials: [],
    coSpeakers: [
      {
        name: "Vikram Mehta",
        role: "Engineering Manager",
        invitation: "accepted",
      },
      { name: "Sara Khan", role: "Staff Engineer", invitation: "invited" },
    ],
    logistics: {
      layout: "Theatre, 500 seats",
      checkIn: "11:00 at the Green Room",
      av: "Four lapel mics, projector",
      host: "Priya Nair",
    },
    registrationTrend: [],
  },
  {
    id: "a1f3c9d2-1b7e-4c55-9a10-5d2f6e8b0a04",
    title: "Offline-first Event Apps with PWAs",
    abstract:
      "Event attendees often lose connectivity in crowded venues. This talk shows how we built an event app that keeps schedules, speaker details and tickets available offline using service workers and background sync.",
    takeaways: [
      "Choosing a caching strategy for each type of event data",
      "Syncing registrations made offline without conflicts",
    ],
    format: "talk",
    durationMinutes: 30,
    track: "mobile-web",
    level: "intermediate",
    status: "under_review",
    eventName: SUMMIT,
    startsAt: null,
    endsAt: null,
    room: null,
    registrations: null,
    attended: null,
    rating: null,
    updatedAt: "2026-10-20T10:00:00.000Z",
    materialsDueAt: null,
    materials: [],
    coSpeakers: [],
    logistics: null,
    registrationTrend: [],
  },
  {
    id: "a1f3c9d2-1b7e-4c55-9a10-5d2f6e8b0a05",
    title: "Observability for Frontend Teams with Sentry",
    abstract:
      "A short tour of what to capture from a browser app (errors, slow interactions, failed requests), what to leave out, and how to keep personal data out of the reports.",
    takeaways: [],
    format: "talk",
    durationMinutes: 30,
    track: "developer-tooling",
    level: "advanced",
    status: "draft",
    eventName: MEETUP,
    startsAt: null,
    endsAt: null,
    room: null,
    registrations: null,
    attended: null,
    rating: null,
    updatedAt: "2026-10-25T10:00:00.000Z",
    materialsDueAt: null,
    materials: [],
    coSpeakers: [],
    logistics: null,
    registrationTrend: [],
  },
  {
    id: "a1f3c9d2-1b7e-4c55-9a10-5d2f6e8b0a06",
    title: "State Management Patterns with Redux Toolkit",
    abstract:
      "Where each kind of state belongs (server cache, client state, form state, the URL) and how to stop reaching for one global store for all of them.",
    takeaways: [
      "Telling server data apart from client state",
      "Keeping derived data out of the store",
    ],
    format: "talk",
    durationMinutes: 45,
    track: "frontend-architecture",
    level: "intermediate",
    status: "completed",
    eventName: "Frontend Day 2025",
    startsAt: "2025-06-14T09:30:00.000Z",
    endsAt: "2025-06-14T10:15:00.000Z",
    room: "Room 2",
    registrations: null,
    attended: 412,
    rating: 4.7,
    updatedAt: "2025-06-16T10:00:00.000Z",
    materialsDueAt: null,
    materials: [
      {
        fileName: "redux-toolkit-patterns.pdf",
        kind: "PDF",
        sizeBytes: 2_411_724,
        uploadedAt: "2025-06-10T10:00:00.000Z",
        visibility: "attendees",
      },
    ],
    coSpeakers: [],
    logistics: {
      layout: "Theatre, 450 seats",
      checkIn: "15:00 at Room 2",
      av: "Projector, HDMI",
      host: "Rohan Desai",
    },
    registrationTrend: [],
  },
];

/** The call for sessions the submit form sends to (sample, like the sessions above). */
export const SAMPLE_SUBMISSION_CALL = {
  eventName: `${SUMMIT} 2026`,
  closesAt: "2026-11-15T23:59:00.000Z",
  /** Days an organizer takes to review, for the intro line. */
  reviewWorkingDays: 10,
  /** The event days (ISO dates) a speaker can say they are free on. */
  days: ["2026-12-03", "2026-12-04", "2026-12-05"],
} as const;
