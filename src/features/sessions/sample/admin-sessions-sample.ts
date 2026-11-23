import type {
  sessionModeEnum,
  sessionTypeEnum,
  SessionStatus,
} from "../../../db/schemas";

// SAMPLE DATA for the admin's "Manage sessions" page (design board AdminSessions). There is no
// API that lists every session of every event yet, so the page shows these rows, marked Static.
// Delete this file when that route exists and the page is wired to it.

export type AdminSessionSample = {
  id: string;
  title: string;
  type: (typeof sessionTypeEnum.enumValues)[number];
  mode: (typeof sessionModeEnum.enumValues)[number];
  event: string;
  organizer: string;
  /** Hall or online room; null = not placed yet. */
  where: string | null;
  /** Already formatted in the event's zone; null = not scheduled yet. */
  when: string | null;
  /** Seats booked / hall seats; null = no seat count (draft or cancelled). */
  seats: { taken: number; of: number } | null;
  status: SessionStatus;
};

export const ADMIN_SESSIONS_SAMPLE: readonly AdminSessionSample[] = [
  {
    id: "sample-1",
    title: "Opening Keynote: The State of Product Engineering",
    type: "keynote",
    mode: "in_person",
    event: "Product Engineering Summit 2026",
    organizer: "Kinetic Events",
    where: "Main Hall",
    when: "Thu 3 Dec · 09:30–10:30",
    seats: { taken: 412, of: 600 },
    status: "scheduled",
  },
  {
    id: "sample-2",
    title: "Scaling Next.js Applications: Lessons from Production",
    type: "talk",
    mode: "in_person",
    event: "Product Engineering Summit 2026",
    organizer: "Kinetic Events",
    where: "Hall B",
    when: "Thu 3 Dec · 10:00–10:45",
    seats: { taken: 248, of: 300 },
    status: "scheduled",
  },
  {
    id: "sample-3",
    title: "Design Tokens at Scale",
    type: "talk",
    mode: "online",
    event: "Design Systems Engineering Day",
    organizer: "Kinetic Events",
    where: "Online room 1",
    when: "Sat 14 Nov · 11:00–11:45",
    seats: { taken: 96, of: 150 },
    status: "scheduled",
  },
  {
    id: "sample-4",
    title: "Cloud Native Basics",
    type: "workshop",
    mode: "in_person",
    event: "Cloud Native Engineering Meetup",
    organizer: "Cloudnine Meetups",
    where: "Room 2",
    when: "Sat 21 Nov · 14:00–16:00",
    seats: { taken: 40, of: 40 },
    status: "scheduled",
  },
  {
    id: "sample-5",
    title: "Micro-frontends in Practice",
    type: "talk",
    mode: "in_person",
    event: "Product Engineering Summit 2026",
    organizer: "Kinetic Events",
    where: "Hall B",
    when: "Thu 3 Dec · 16:30–17:15",
    seats: null,
    status: "cancelled",
  },
  {
    id: "sample-6",
    title: "Observability for Frontend Teams",
    type: "talk",
    mode: "in_person",
    event: "Fintech Product Forum",
    organizer: "Kinetic Events",
    where: null,
    when: null,
    seats: null,
    status: "draft",
  },
];
