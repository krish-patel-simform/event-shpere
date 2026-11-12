import { NotFoundError } from "../../../../core/http/errors";
import {
  listSpeakerSessionsQuerySchema,
  speakerSessionsMetaSchema,
  speakerSessionsResponseSchema,
} from "../../schemas/speaker-sessions.schemas";
import type { SpeakerSessionGroupRow } from "../speaker-session.repository";
import {
  createSpeakerSessionService,
  type SpeakerSessionServiceDeps,
} from "../speaker-session.service";

// Empty factories: the DB client and env are never loaded.
jest.mock("../speaker.repository", () => ({}));
jest.mock("../speaker-session.repository", () => ({}));

const speakerId = "6b2c3d4e-5f6a-4b7c-9d8e-0f1a2b3c4d01";
const slug = "ananya-rao-3f9a1c";
const sessionId = "a0000000-0000-4000-8000-000000000001";

const session = (
  overrides: Partial<SpeakerSessionGroupRow["sessions"][number]> = {},
) => ({
  id: sessionId,
  title: "Design Tokens at Scale",
  type: "talk" as const,
  mode: "in_person" as const,
  startAt: new Date("2026-11-14T05:30:00.000Z"),
  endAt: new Date("2026-11-14T06:15:00.000Z"),
  hallName: "Hall A",
  hallCapacity: 100,
  price: 0,
  requiresRegistration: true,
  booked: 46,
  ...overrides,
});

const group = (
  sessions = [session()],
  eventOverrides: Partial<SpeakerSessionGroupRow["event"]> = {},
): SpeakerSessionGroupRow => ({
  event: {
    slug: "design-systems-day",
    title: "Design Systems Engineering Day",
    startAt: new Date("2026-11-14T03:30:00.000Z"),
    endAt: new Date("2026-11-14T12:30:00.000Z"),
    timezone: "Asia/Kolkata",
    venueName: "Tech Park Auditorium",
    venueCity: "Pune",
    ticketPrice: 0,
    ...eventOverrides,
  },
  sessions,
});

function makeService(
  listSpeakerSessions: jest.Mock = jest.fn(),
  findBySlug: jest.Mock = jest.fn().mockResolvedValue({ id: speakerId, slug }),
) {
  const deps: SpeakerSessionServiceDeps = {
    speakerRepository: { findBySlug },
    speakerSessionRepository: { listSpeakerSessions },
  };
  return createSpeakerSessionService(deps);
}

const query = (raw: Record<string, string> = {}) =>
  listSpeakerSessionsQuerySchema.parse(raw);

describe("speakerSessionService.listSpeakerSessions", () => {
  it("returns the events with their sessions and the totals, as valid DTOs", async () => {
    const listSpeakerSessions = jest.fn().mockResolvedValue({
      groups: [group()],
      totalEvents: 1,
      totalSessions: 1,
    });

    const { items, meta } = await makeService(
      listSpeakerSessions,
    ).listSpeakerSessions(slug, query({ timeline: "upcoming" }));

    expect(speakerSessionsResponseSchema.parse(items)).toEqual(items);
    expect(speakerSessionsMetaSchema.parse(meta)).toEqual(meta);
    expect(items[0]?.event).toMatchObject({
      slug: "design-systems-day",
      venue: { name: "Tech Park Auditorium", city: "Pune" },
      startAt: "2026-11-14T03:30:00.000Z",
    });
    expect(items[0]?.sessions[0]).toMatchObject({
      id: sessionId,
      startAt: "2026-11-14T05:30:00.000Z",
      hallName: "Hall A",
    });
    expect(meta).toEqual({ page: 1, pageSize: 5, total: 1, totalSessions: 1 });
  });

  it("asks for this speaker's category, turning page and pageSize into limit and offset", async () => {
    const listSpeakerSessions = jest
      .fn()
      .mockResolvedValue({ groups: [], totalEvents: 0, totalSessions: 0 });

    await makeService(listSpeakerSessions).listSpeakerSessions(
      slug,
      query({ timeline: "past", page: "3", pageSize: "4" }),
    );

    expect(listSpeakerSessions).toHaveBeenCalledWith({
      speakerId,
      timeline: "past",
      limit: 4,
      offset: 8,
    });
  });

  it("is a 404 for an unknown or suspended speaker, without looking for sessions", async () => {
    const listSpeakerSessions = jest.fn();
    const findBySlug = jest.fn().mockResolvedValue(null);

    await expect(
      makeService(listSpeakerSessions, findBySlug).listSpeakerSessions(
        slug,
        query(),
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(listSpeakerSessions).not.toHaveBeenCalled();
  });

  it("has no venue for an online event", async () => {
    const listSpeakerSessions = jest.fn().mockResolvedValue({
      groups: [group([session()], { venueName: null, venueCity: null })],
      totalEvents: 1,
      totalSessions: 1,
    });

    const { items } = await makeService(
      listSpeakerSessions,
    ).listSpeakerSessions(slug, query());

    expect(items[0]?.event.venue).toBeNull();
  });

  describe("seats left", () => {
    const seatsFor = async (
      overrides: Partial<SpeakerSessionGroupRow["sessions"][number]>,
    ) => {
      const listSpeakerSessions = jest.fn().mockResolvedValue({
        groups: [group([session(overrides)])],
        totalEvents: 1,
        totalSessions: 1,
      });
      const { items } = await makeService(
        listSpeakerSessions,
      ).listSpeakerSessions(slug, query());
      return items[0]?.sessions[0]?.seatsLeft;
    };

    it("is the hall's seats minus the bookings", async () => {
      expect(await seatsFor({ hallCapacity: 100, booked: 46 })).toBe(54);
    });

    it("is 0 when full, never negative", async () => {
      expect(await seatsFor({ hallCapacity: 30, booked: 30 })).toBe(0);
      expect(await seatsFor({ hallCapacity: 30, booked: 35 })).toBe(0);
    });

    it("is null when the session needs no booking, or has no hall", async () => {
      expect(await seatsFor({ requiresRegistration: false })).toBeNull();
      expect(
        await seatsFor({ hallName: null, hallCapacity: null, mode: "online" }),
      ).toBeNull();
    });
  });
});

describe("listSpeakerSessionsQuerySchema", () => {
  it("defaults to the upcoming category, first page of 5 events", () => {
    expect(query()).toEqual({ timeline: "upcoming", page: 1, pageSize: 5 });
  });

  it("accepts the three categories and refuses any other", () => {
    for (const timeline of ["now", "upcoming", "past"]) {
      expect(query({ timeline }).timeline).toBe(timeline);
    }
    expect(
      listSpeakerSessionsQuerySchema.safeParse({ timeline: "later" }).success,
    ).toBe(false);
  });

  it("refuses paging out of range", () => {
    for (const raw of [{ page: "0" }, { pageSize: "0" }, { pageSize: "21" }]) {
      expect(listSpeakerSessionsQuerySchema.safeParse(raw).success).toBe(false);
    }
  });
});
