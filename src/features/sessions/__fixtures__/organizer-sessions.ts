import type { SessionDto } from "../schemas/sessions.schemas";

// Sessions as the organizer's API answers them (GET /api/events/[eventId]/sessions), for the
// tests of the organizer pages. Times are UTC; the sample event is in India (+05:30).

export const EVENT_ID = "3f2b8a10-6c4d-4e57-8b19-0a1d2c3e4f01";
export const HALL_A_ID = "5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c01";
export const HALL_B_ID = "5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c02";
export const SPEAKER_ANANYA_ID = "6b2c3d4e-5f6a-4b7c-9d8e-0f1a2b3c4d01";
export const SPEAKER_ROHAN_ID = "6b2c3d4e-5f6a-4b7c-9d8e-0f1a2b3c4d02";

/** A scheduled in-person talk, 10:00 – 11:00 IST on 12 Dec 2026, free with the ticket. */
export const talk: SessionDto = {
  id: "7c3d4e5f-6a7b-4c8d-ae9f-1a2b3c4d5e01",
  eventId: EVENT_ID,
  hallId: HALL_A_ID,
  hallName: "Hall A",
  title: "Offline-first Event Apps",
  type: "talk",
  mode: "in_person",
  status: "scheduled",
  onlineUrl: null,
  startAt: "2026-12-12T04:30:00.000Z",
  endAt: "2026-12-12T05:30:00.000Z",
  requiresRegistration: false,
  price: 0,
  speakers: [
    {
      speakerId: SPEAKER_ANANYA_ID,
      name: "Ananya Rao",
      role: "speaker",
      displayOrder: 0,
    },
  ],
};

/** A hybrid paid workshop with two speakers (listed out of order, to check the display order). */
export const workshop: SessionDto = {
  id: "7c3d4e5f-6a7b-4c8d-ae9f-1a2b3c4d5e02",
  eventId: EVENT_ID,
  hallId: HALL_B_ID,
  hallName: "Hall B",
  title: "Design Systems in Practice",
  type: "workshop",
  mode: "hybrid",
  status: "draft",
  onlineUrl: "https://meet.example.com/design-systems",
  startAt: "2026-12-12T06:30:00.000Z",
  endAt: "2026-12-12T08:30:00.000Z",
  requiresRegistration: true,
  price: 49950,
  speakers: [
    {
      speakerId: SPEAKER_ROHAN_ID,
      name: "Rohan Mehta",
      role: "moderator",
      displayOrder: 1,
    },
    {
      speakerId: SPEAKER_ANANYA_ID,
      name: "Ananya Rao",
      role: "speaker",
      displayOrder: 0,
    },
  ],
};

/** An online keynote with no hall, cancelled. */
export const cancelledKeynote: SessionDto = {
  id: "7c3d4e5f-6a7b-4c8d-ae9f-1a2b3c4d5e03",
  eventId: EVENT_ID,
  hallId: null,
  hallName: null,
  title: "Opening Keynote",
  type: "keynote",
  mode: "online",
  status: "cancelled",
  onlineUrl: "https://meet.example.com/keynote",
  startAt: "2026-12-11T03:30:00.000Z",
  endAt: "2026-12-11T04:30:00.000Z",
  requiresRegistration: false,
  price: 0,
  speakers: [
    {
      speakerId: SPEAKER_ROHAN_ID,
      name: "Rohan Mehta",
      role: "speaker",
      displayOrder: 0,
    },
  ],
};

export const organizerSessions: readonly SessionDto[] = [
  cancelledKeynote,
  talk,
  workshop,
];
