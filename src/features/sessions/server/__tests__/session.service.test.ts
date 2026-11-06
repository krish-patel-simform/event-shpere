import { DrizzleQueryError } from "drizzle-orm";
import { PERMISSION } from "../../../../core/auth/permission-catalog";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
  ValidationError,
} from "../../../../core/http/errors";
import type { CmsSessionDetail } from "../../../cms";
import {
  sessionContentResponseSchema,
  updateSessionContentBodySchema,
  type UpdateSessionContentRequest,
} from "../../schemas/session-content.schemas";
import {
  createSessionBodySchema,
  replaceSessionSpeakersBodySchema,
  sessionListResponseSchema,
  sessionResponseSchema,
  updateSessionBodySchema,
  type CreateSessionRequest,
  type ReplaceSessionSpeakersRequest,
  type UpdateSessionRequest,
} from "../../schemas/sessions.schemas";
import { HALL_OVERLAP_CONSTRAINT } from "../hall-clash";
import { createSessionService } from "../session.service";
import type {
  NewSession,
  SessionPatch,
  SessionWithSpeakers,
} from "../session.repository";

// Empty factories: the DB client, Strapi client and env are never loaded.
jest.mock("../session.repository", () => ({}));
jest.mock("../hall-booking.repository", () => ({}));
// The Strapi clients are never loaded; the image helpers are pure, so the real ones are kept.
jest.mock("../../../cms/server", () =>
  jest.requireActual("../../../cms/server/image-upload"),
);
jest.mock("../../../events/server", () => ({}));

const eventId = "8c1f4f6e-2f4b-4c43-9a59-0d6f2a1b7e10";
const venueId = "9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const hallId = "3f2b8a10-6c4d-4e57-8b19-0a1d2c3e4f01";
const speakerId = "4a5b6c7d-8e9f-4a0b-9c1d-2e3f4a5b6c7d";
const moderatorId = "5b6c7d8e-9f0a-4b1c-8d2e-3f4a5b6c7d8e";

const organizer = {
  id: "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
  role: "organizer" as const,
  permissions: new Set<string>([PERMISSION.SESSION_CREATE]),
};
const admin = {
  id: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
  role: "admin" as const,
  permissions: new Set<string>([PERMISSION.SESSION_CREATE]),
};

// What the access check returns: the organizer's event, 04:00-12:00 UTC (09:30-17:30 IST) on
// 12 Dec 2026, at one venue.
const event = {
  id: eventId,
  organizerId: "5d1c3a4b-7e8f-4a1b-9c2d-3e4f5a6b7c8d",
  status: "draft" as const,
  cmsEventId: "doc-1",
  venueId,
  startAt: new Date("2026-12-12T04:00:00.000Z"),
  endAt: new Date("2026-12-12T12:00:00.000Z"),
  timezone: "Asia/Kolkata",
};

/** The "now" of every service test, so nothing depends on the real clock. */
const NOW = new Date("2026-11-03T10:00:00.000Z");

/** A cover as Strapi's media library stores it: a real 800x600 JPEG of 100 KB. */
const newFile = {
  id: 31,
  mime: "image/jpeg",
  size: 100,
  width: 800,
  height: 600,
};

const inPerson: CreateSessionRequest = {
  title: "Offline-first Event Apps",
  type: "talk",
  mode: "in_person",
  hallId,
  startAt: "2026-12-12T10:00:00+05:30",
  endAt: "2026-12-12T11:00:00+05:30",
  speakers: [{ speakerId, role: "speaker" }],
};
const parse = (overrides: Partial<CreateSessionRequest> = {}) =>
  createSessionBodySchema.parse({ ...inPerson, ...overrides });

function setup(eventRow: typeof event = event) {
  const access = { getEventIfOrgOwns: jest.fn().mockResolvedValue(eventRow) };
  const repo = {
    findHall: jest.fn().mockResolvedValue({
      id: hallId,
      venueId,
      isActive: true,
      capacity: 100,
    }),
    listSessionsByEvent: jest.fn().mockResolvedValue([]),
    findSessionInEvent: jest.fn().mockResolvedValue(null),
    findPublicSession: jest.fn().mockResolvedValue(null),
    setCmsSessionId: jest.fn().mockResolvedValue(undefined),
    countActiveBookings: jest.fn().mockResolvedValue(0),
    // Like the database: the saved session with exactly the new speakers, in order.
    replaceSessionSpeakers: jest
      .fn()
      .mockImplementation(
        async (
          _id: string,
          speakers: NewSession["speakers"],
        ): Promise<SessionWithSpeakers> => ({
          ...sessionRow,
          speakers: speakers.map((speaker, displayOrder) => ({
            ...speaker,
            name: "Speaker Name",
            displayOrder,
          })),
        }),
      ),
    // Like the database: the saved session, cancelled at the given time.
    cancelSession: jest
      .fn()
      .mockImplementation(
        async (_id: string, at: Date): Promise<SessionWithSpeakers> => ({
          ...sessionRow,
          status: "cancelled",
          cancelledAt: at,
        }),
      ),
    // Like the database: the saved session with the patch applied.
    updateSession: jest
      .fn()
      .mockImplementation(
        async (
          _id: string,
          patch: SessionPatch,
        ): Promise<SessionWithSpeakers> => ({
          ...sessionRow,
          ...patch,
        }),
      ),
    findExistingSpeakerIds: jest
      .fn()
      .mockImplementation(async (ids: string[]) => ids),
    createSession: jest
      .fn()
      .mockImplementation(
        async (input: NewSession): Promise<SessionWithSpeakers> => ({
          ...input,
          hallName: input.hallId ? "Main Hall" : null,
          cancelledAt: null,
          createdAt: new Date("2026-11-03T10:00:00.000Z"),
          updatedAt: new Date("2026-11-03T10:00:00.000Z"),
          speakers: input.speakers.map((speaker, displayOrder) => ({
            ...speaker,
            name: "Speaker Name",
            displayOrder,
          })),
        }),
      ),
  };
  const hallBooking = {
    assertHallFree: jest.fn().mockResolvedValue(undefined),
  };
  const speakerBooking = {
    assertSpeakersFree: jest.fn().mockResolvedValue(undefined),
  };
  const strapi = {
    createSessionDetail: jest.fn().mockResolvedValue({ documentId: "doc-new" }),
    deleteSessionDetail: jest.fn().mockResolvedValue(undefined),
    findSessionDetailById: jest.fn().mockResolvedValue(null),
    updateSessionDetail: jest.fn().mockResolvedValue(null),
  };
  const media = {
    uploadFiles: jest.fn().mockResolvedValue({ ok: true, files: [newFile] }),
    deleteFile: jest.fn().mockResolvedValue(undefined),
  };
  const service = createSessionService({
    eventAccess: access,
    sessionRepository: repo,
    hallBooking,
    speakerBooking,
    strapiClient: strapi,
    mediaClient: media,
    now: () => NOW,
  });
  return { service, access, repo, hallBooking, speakerBooking, strapi, media };
}

describe("sessionService.createSession", () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => errorSpy.mockRestore());

  it("saves the session and its speakers, linked to its Strapi draft by one shared id", async () => {
    const { service, repo, strapi, hallBooking } = setup();

    const dto = await service.createSession(eventId, parse(), organizer);

    const { sessionId } = strapi.createSessionDetail.mock.calls[0][0] as {
      sessionId: string;
    };
    expect(hallBooking.assertHallFree).toHaveBeenCalledWith({
      hallId,
      startAt: new Date("2026-12-12T04:30:00.000Z"),
      endAt: new Date("2026-12-12T05:30:00.000Z"),
    });
    expect(repo.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        id: sessionId,
        eventId,
        hallId,
        cmsSessionId: "doc-new",
        status: "scheduled",
        onlineUrl: null,
        requiresRegistration: false,
        price: 0,
        speakers: [{ speakerId, role: "speaker" }],
      }),
    );
    expect(dto.id).toBe(sessionId);
    expect(dto.speakers).toEqual([
      { speakerId, name: "Speaker Name", role: "speaker", displayOrder: 0 },
    ]);
    // The names a list screen needs come with the answer: no second lookup.
    expect(dto.hallName).toBe("Main Hall");
  });

  it("answers no hall name for an online session", async () => {
    const { service } = setup();

    const dto = await service.createSession(
      eventId,
      parse({
        mode: "online",
        hallId: undefined,
        onlineUrl: "https://meet.example.com/abc",
      }),
      organizer,
    );

    expect(dto.hallName).toBeNull();
  });

  it("returns a DTO that matches the response schema and hides internal fields", async () => {
    const { service } = setup();

    const dto = await service.createSession(eventId, parse(), organizer);

    expect(() => sessionResponseSchema.parse(dto)).not.toThrow();
    expect(dto).not.toHaveProperty("cmsSessionId");
    expect(dto).not.toHaveProperty("cancelledAt");
  });

  it("keeps the speakers' order and roles", async () => {
    const { service, repo } = setup();

    await service.createSession(
      eventId,
      parse({
        speakers: [
          { speakerId: moderatorId, role: "moderator" },
          { speakerId, role: "speaker" },
        ],
      }),
      organizer,
    );

    expect(repo.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        speakers: [
          { speakerId: moderatorId, role: "moderator" },
          { speakerId, role: "speaker" },
        ],
      }),
    );
  });

  it("needs no hall for an online session: nothing to check or book", async () => {
    const { service, repo, hallBooking } = setup();

    await service.createSession(
      eventId,
      parse({
        mode: "online",
        hallId: undefined,
        onlineUrl: "https://meet.example.com/abc",
      }),
      organizer,
    );

    expect(repo.findHall).not.toHaveBeenCalled();
    expect(hallBooking.assertHallFree).not.toHaveBeenCalled();
    expect(repo.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        hallId: null,
        onlineUrl: "https://meet.example.com/abc",
      }),
    );
  });

  describe("who may create", () => {
    it("refuses an admin (403): there is no organizer profile to own the session", async () => {
      const { service, access, strapi } = setup();

      await expect(
        service.createSession(eventId, parse(), admin),
      ).rejects.toBeInstanceOf(ForbiddenError);
      expect(access.getEventIfOrgOwns).not.toHaveBeenCalled();
      expect(strapi.createSessionDetail).not.toHaveBeenCalled();
    });

    it("answers 404 for an event that is not the caller's and saves nothing", async () => {
      const { service, access, repo, strapi } = setup();
      access.getEventIfOrgOwns.mockRejectedValue(
        new NotFoundError("Event not found"),
      );

      await expect(
        service.createSession(eventId, parse(), organizer),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(access.getEventIfOrgOwns).toHaveBeenCalledWith(
        eventId,
        organizer,
        {
          write: true,
        },
      );
      expect(strapi.createSessionDetail).not.toHaveBeenCalled();
      expect(repo.createSession).not.toHaveBeenCalled();
    });

    it("answers 409 for a cancelled event", async () => {
      const { service, access, strapi } = setup();
      access.getEventIfOrgOwns.mockRejectedValue(
        new ConflictError(
          "EVENT_CANCELLED",
          "A cancelled event can no longer be edited",
        ),
      );

      await expect(
        service.createSession(eventId, parse(), organizer),
      ).rejects.toMatchObject({ code: "EVENT_CANCELLED" });
      expect(strapi.createSessionDetail).not.toHaveBeenCalled();
    });
  });

  describe("the slot, hall and speakers", () => {
    it("refuses a session that starts before the event (400)", async () => {
      const { service, strapi } = setup();

      await expect(
        service.createSession(
          eventId,
          parse({
            startAt: "2026-12-12T09:00:00+05:30", // 03:30 UTC
            endAt: "2026-12-12T11:00:00+05:30",
          }),
          organizer,
        ),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(strapi.createSessionDetail).not.toHaveBeenCalled();
    });

    it("refuses a session that ends after the event (400)", async () => {
      const { service } = setup();

      await expect(
        service.createSession(
          eventId,
          parse({
            startAt: "2026-12-12T16:00:00+05:30",
            endAt: "2026-12-12T18:00:00+05:30", // 12:30 UTC
          }),
          organizer,
        ),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it("accepts a session that fills the event exactly", async () => {
      const { service } = setup();

      await expect(
        service.createSession(
          eventId,
          parse({
            startAt: "2026-12-12T09:30:00+05:30",
            endAt: "2026-12-12T17:30:00+05:30",
          }),
          organizer,
        ),
      ).resolves.toBeDefined();
    });

    it("answers 409 when the event has no venue yet", async () => {
      const { service, access } = setup();
      access.getEventIfOrgOwns.mockResolvedValue({ ...event, venueId: null });

      await expect(
        service.createSession(eventId, parse(), organizer),
      ).rejects.toMatchObject({ code: "EVENT_HAS_NO_VENUE" });
    });

    it("answers 404 for a hall that does not exist", async () => {
      const { service, repo } = setup();
      repo.findHall.mockResolvedValue(null);

      await expect(
        service.createSession(eventId, parse(), organizer),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("answers 404 for a hall of another venue, the same as a missing one", async () => {
      const { service, repo, strapi } = setup();
      repo.findHall.mockResolvedValue({
        id: hallId,
        venueId: "0d9c8b7a-6f5e-4d3c-8b2a-1f0e9d8c7b6a",
        isActive: true,
      });

      await expect(
        service.createSession(eventId, parse(), organizer),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(strapi.createSessionDetail).not.toHaveBeenCalled();
    });

    it("answers 409 HALL_INACTIVE for a retired hall", async () => {
      const { service, repo } = setup();
      repo.findHall.mockResolvedValue({ id: hallId, venueId, isActive: false });

      await expect(
        service.createSession(eventId, parse(), organizer),
      ).rejects.toMatchObject({ code: "HALL_INACTIVE" });
    });

    it("answers 409 HALL_BUSY when the hall is taken, before touching Strapi", async () => {
      const { service, hallBooking, strapi, repo } = setup();
      hallBooking.assertHallFree.mockRejectedValue(
        new ConflictError("HALL_BUSY", "This hall is already booked"),
      );

      await expect(
        service.createSession(eventId, parse(), organizer),
      ).rejects.toMatchObject({ code: "HALL_BUSY" });
      expect(strapi.createSessionDetail).not.toHaveBeenCalled();
      expect(repo.createSession).not.toHaveBeenCalled();
    });

    it("asks whether EVERY speaker is free during the slot, whatever the hall", async () => {
      const { service, speakerBooking } = setup();

      await service.createSession(
        eventId,
        parse({
          speakers: [
            { speakerId, role: "speaker" },
            { speakerId: moderatorId, role: "moderator" },
          ],
        }),
        organizer,
      );

      expect(speakerBooking.assertSpeakersFree).toHaveBeenCalledWith({
        speakerIds: [speakerId, moderatorId],
        startAt: new Date("2026-12-12T04:30:00.000Z"),
        endAt: new Date("2026-12-12T05:30:00.000Z"),
      });
    });

    it("checks the speakers of an online session too: it has no hall, but a speaker has one body", async () => {
      const { service, speakerBooking, hallBooking } = setup();

      await service.createSession(
        eventId,
        parse({
          mode: "online",
          hallId: undefined,
          onlineUrl: "https://meet.example.com/abc",
        }),
        organizer,
      );

      expect(hallBooking.assertHallFree).not.toHaveBeenCalled();
      expect(speakerBooking.assertSpeakersFree).toHaveBeenCalledTimes(1);
    });

    it("answers 409 SPEAKER_BUSY when a speaker is on another session, before touching Strapi", async () => {
      const { service, speakerBooking, strapi, repo } = setup();
      speakerBooking.assertSpeakersFree.mockRejectedValue(
        new ConflictError("SPEAKER_BUSY", "Anna Rao is already booked"),
      );

      await expect(
        service.createSession(eventId, parse(), organizer),
      ).rejects.toMatchObject({ status: 409, code: "SPEAKER_BUSY" });
      expect(strapi.createSessionDetail).not.toHaveBeenCalled();
      expect(repo.createSession).not.toHaveBeenCalled();
    });

    it("refuses an id that is not a speaker profile (400), e.g. a user id, before asking about their time", async () => {
      const { service, repo, strapi, speakerBooking } = setup();
      repo.findExistingSpeakerIds.mockResolvedValue([]);

      await expect(
        service.createSession(eventId, parse(), organizer),
      ).rejects.toMatchObject({
        status: 400,
        details: { speakerIds: [speakerId] },
      });
      expect(speakerBooking.assertSpeakersFree).not.toHaveBeenCalled();
      expect(strapi.createSessionDetail).not.toHaveBeenCalled();
    });
  });

  describe("Strapi and the database", () => {
    it("answers 503 and saves nothing when Strapi is down", async () => {
      const { service, strapi, repo } = setup();
      strapi.createSessionDetail.mockRejectedValue(new Error("ECONNREFUSED"));

      await expect(
        service.createSession(eventId, parse(), organizer),
      ).rejects.toBeInstanceOf(ServiceUnavailableError);
      expect(repo.createSession).not.toHaveBeenCalled();
    });

    it("removes the Strapi draft again when the insert fails, and rethrows the original error", async () => {
      const { service, repo, strapi } = setup();
      const failure = new Error("insert failed");
      repo.createSession.mockRejectedValue(failure);

      await expect(
        service.createSession(eventId, parse(), organizer),
      ).rejects.toBe(failure);
      expect(strapi.deleteSessionDetail).toHaveBeenCalledWith("doc-new");
    });

    it("still rethrows the original error when the Strapi cleanup fails too", async () => {
      const { service, repo, strapi } = setup();
      const failure = new Error("insert failed");
      repo.createSession.mockRejectedValue(failure);
      strapi.deleteSessionDetail.mockRejectedValue(new Error("cleanup failed"));

      await expect(
        service.createSession(eventId, parse(), organizer),
      ).rejects.toBe(failure);
    });
  });
});

const sessionId = "6c7d8e9f-0a1b-4c2d-9e3f-4a5b6c7d8e9f";

/** A saved session as the repository returns it. */
const sessionRow: SessionWithSpeakers = {
  id: sessionId,
  eventId,
  hallId,
  hallName: "Main Hall",
  title: "Offline-first Event Apps",
  mode: "in_person",
  onlineUrl: null,
  cmsSessionId: "doc-1",
  type: "talk",
  status: "scheduled",
  startAt: new Date("2026-12-12T04:30:00.000Z"),
  endAt: new Date("2026-12-12T05:30:00.000Z"),
  requiresRegistration: false,
  price: 0,
  cancelledAt: null,
  createdAt: new Date("2026-11-03T10:00:00.000Z"),
  updatedAt: new Date("2026-11-03T10:00:00.000Z"),
  speakers: [{ speakerId, name: "Anna Rao", role: "speaker", displayOrder: 0 }],
};

describe("sessionService.listSessions", () => {
  it("returns the event's sessions as DTOs, after checking the event is the caller's", async () => {
    const { service, access, repo } = setup();
    repo.listSessionsByEvent.mockResolvedValue([sessionRow]);

    const list = await service.listSessions(eventId, organizer);

    expect(access.getEventIfOrgOwns).toHaveBeenCalledWith(eventId, organizer, {
      write: false,
    });
    expect(repo.listSessionsByEvent).toHaveBeenCalledWith(eventId);
    expect(() => sessionListResponseSchema.parse(list)).not.toThrow();
    expect(list).toHaveLength(1);
    expect(list[0]).not.toHaveProperty("cmsSessionId");
    // The names the list screen shows: the hall's and each speaker's.
    expect(list[0]?.hallName).toBe("Main Hall");
    expect(list[0]?.speakers[0]?.name).toBe("Anna Rao");
  });

  it("returns an empty list for an event with no sessions", async () => {
    const { service } = setup();

    await expect(service.listSessions(eventId, organizer)).resolves.toEqual([]);
  });

  it("answers 404 for someone else's event and reads no sessions", async () => {
    const { service, access, repo } = setup();
    access.getEventIfOrgOwns.mockRejectedValue(
      new NotFoundError("Event not found"),
    );

    await expect(
      service.listSessions(eventId, organizer),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(repo.listSessionsByEvent).not.toHaveBeenCalled();
  });
});

describe("sessionService.getSession", () => {
  it("returns the session, looked up with BOTH ids so it cannot reach across events", async () => {
    const { service, repo } = setup();
    repo.findSessionInEvent.mockResolvedValue(sessionRow);

    const session = await service.getSession(eventId, sessionId, organizer);

    expect(repo.findSessionInEvent).toHaveBeenCalledWith(eventId, sessionId);
    expect(() => sessionResponseSchema.parse(session)).not.toThrow();
    expect(session.id).toBe(sessionId);
    expect(session).not.toHaveProperty("cmsSessionId");
  });

  it("answers 404 for a session that is not in this event", async () => {
    const { service } = setup();

    await expect(
      service.getSession(eventId, sessionId, organizer),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("answers 404 for someone else's event before looking for the session", async () => {
    const { service, access, repo } = setup();
    access.getEventIfOrgOwns.mockRejectedValue(
      new NotFoundError("Event not found"),
    );

    await expect(
      service.getSession(eventId, sessionId, organizer),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(repo.findSessionInEvent).not.toHaveBeenCalled();
  });
});

/** A cover as the Strapi client returns it (the file id is the new upload's id, 31). */
const cover = {
  id: 31,
  url: "http://cms.test/uploads/cover.jpg",
  alt: null,
  width: 800,
  height: 600,
};

/** The session's Strapi entry as the client returns it. */
const detail: CmsSessionDetail = {
  documentId: "doc-1",
  description: [
    { type: "paragraph", children: [{ type: "text", text: "Hello" }] },
  ],
  prerequisites: "Know some JS",
  coverImage: null,
  resources: [{ label: "Slides", url: "https://example.com/s" }],
};

describe("sessionService.getContent", () => {
  it("reads the Strapi entry linked from the session's own row and answers plain text", async () => {
    const { service, repo, strapi } = setup();
    repo.findSessionInEvent.mockResolvedValue(sessionRow);
    strapi.findSessionDetailById.mockResolvedValue(detail);

    const content = await service.getContent(eventId, sessionId, organizer);

    expect(strapi.findSessionDetailById).toHaveBeenCalledWith("doc-1");
    expect(() => sessionContentResponseSchema.parse(content)).not.toThrow();
    expect(content).toEqual({
      description: "Hello",
      prerequisites: "Know some JS",
      resources: [{ label: "Slides", url: "https://example.com/s" }],
      coverImage: null,
    });
  });

  it("includes the current cover image", async () => {
    const { service, repo, strapi } = setup();
    repo.findSessionInEvent.mockResolvedValue(sessionRow);
    strapi.findSessionDetailById.mockResolvedValue({
      ...detail,
      coverImage: cover,
    });

    const content = await service.getContent(eventId, sessionId, organizer);

    expect(content.coverImage).toEqual(cover);
  });

  it("answers an empty form when the session has no Strapi link yet, without calling Strapi", async () => {
    const { service, repo, strapi } = setup();
    repo.findSessionInEvent.mockResolvedValue({
      ...sessionRow,
      cmsSessionId: null,
    });

    await expect(
      service.getContent(eventId, sessionId, organizer),
    ).resolves.toEqual({
      description: "",
      prerequisites: null,
      resources: [],
      coverImage: null,
    });
    expect(strapi.findSessionDetailById).not.toHaveBeenCalled();
  });

  it("answers 404 for a session that is not in this event, without calling Strapi", async () => {
    const { service, strapi } = setup();

    await expect(
      service.getContent(eventId, sessionId, organizer),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(strapi.findSessionDetailById).not.toHaveBeenCalled();
  });

  it("answers 404 for someone else's event before touching the session or Strapi", async () => {
    const { service, access, repo, strapi } = setup();
    access.getEventIfOrgOwns.mockRejectedValue(
      new NotFoundError("Event not found"),
    );

    await expect(
      service.getContent(eventId, sessionId, organizer),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(repo.findSessionInEvent).not.toHaveBeenCalled();
    expect(strapi.findSessionDetailById).not.toHaveBeenCalled();
  });

  it("answers 503, never an empty form, when Strapi is down", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const { service, repo, strapi } = setup();
    repo.findSessionInEvent.mockResolvedValue(sessionRow);
    strapi.findSessionDetailById.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(
      service.getContent(eventId, sessionId, organizer),
    ).rejects.toBeInstanceOf(ServiceUnavailableError);
    errorSpy.mockRestore();
  });
});

describe("sessionService.updateContent", () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => errorSpy.mockRestore());

  const update = (body: UpdateSessionContentRequest) =>
    updateSessionContentBodySchema.parse(body);

  it("sends only the fields that were sent, and answers the saved content", async () => {
    const { service, access, repo, strapi } = setup();
    repo.findSessionInEvent.mockResolvedValue(sessionRow);
    strapi.updateSessionDetail.mockResolvedValue(detail);

    const content = await service.updateContent(
      eventId,
      sessionId,
      update({ prerequisites: "Know some JS" }),
      organizer,
    );

    expect(access.getEventIfOrgOwns).toHaveBeenCalledWith(eventId, organizer, {
      write: true,
    });
    expect(strapi.updateSessionDetail).toHaveBeenCalledWith("doc-1", {
      prerequisites: "Know some JS",
    });
    expect(content.prerequisites).toBe("Know some JS");
  });

  it("turns the description into blocks and replaces the resources", async () => {
    const { service, repo, strapi } = setup();
    repo.findSessionInEvent.mockResolvedValue(sessionRow);
    strapi.updateSessionDetail.mockResolvedValue(detail);

    await service.updateContent(
      eventId,
      sessionId,
      update({
        description: "First\n\nSecond",
        resources: [{ label: "Slides", url: "https://example.com/s" }],
      }),
      organizer,
    );

    expect(strapi.updateSessionDetail).toHaveBeenCalledWith("doc-1", {
      description: [
        { type: "paragraph", children: [{ type: "text", text: "First" }] },
        { type: "paragraph", children: [{ type: "text", text: "Second" }] },
      ],
      resources: [{ label: "Slides", url: "https://example.com/s" }],
    });
  });

  it("clears a text when it is sent empty or null", async () => {
    const { service, repo, strapi } = setup();
    repo.findSessionInEvent.mockResolvedValue(sessionRow);
    strapi.updateSessionDetail.mockResolvedValue(detail);

    await service.updateContent(
      eventId,
      sessionId,
      update({ description: "", prerequisites: null }),
      organizer,
    );

    expect(strapi.updateSessionDetail).toHaveBeenCalledWith("doc-1", {
      description: null,
      prerequisites: null,
    });
  });

  it("answers 409 for a cancelled event and saves nothing", async () => {
    const { service, access, strapi } = setup();
    access.getEventIfOrgOwns.mockRejectedValue(
      new ConflictError(
        "EVENT_CANCELLED",
        "A cancelled event can no longer be edited",
      ),
    );

    await expect(
      service.updateContent(
        eventId,
        sessionId,
        update({ prerequisites: "x" }),
        organizer,
      ),
    ).rejects.toMatchObject({ code: "EVENT_CANCELLED" });
    expect(strapi.updateSessionDetail).not.toHaveBeenCalled();
  });

  it("answers 404 for a session of another event and never touches Strapi", async () => {
    const { service, strapi } = setup();

    await expect(
      service.updateContent(
        eventId,
        sessionId,
        update({ prerequisites: "x" }),
        organizer,
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(strapi.updateSessionDetail).not.toHaveBeenCalled();
    expect(strapi.createSessionDetail).not.toHaveBeenCalled();
  });

  it("creates and links an entry first when the session has none yet", async () => {
    const { service, repo, strapi } = setup();
    repo.findSessionInEvent.mockResolvedValue({
      ...sessionRow,
      cmsSessionId: null,
    });
    strapi.updateSessionDetail.mockResolvedValue({
      ...detail,
      documentId: "doc-new",
    });

    await service.updateContent(
      eventId,
      sessionId,
      update({ prerequisites: "Know some JS" }),
      organizer,
    );

    expect(strapi.createSessionDetail).toHaveBeenCalledWith({ sessionId });
    expect(repo.setCmsSessionId).toHaveBeenCalledWith(sessionId, "doc-new");
    expect(strapi.updateSessionDetail).toHaveBeenCalledWith("doc-new", {
      prerequisites: "Know some JS",
    });
  });

  it("creates a new entry when the linked one was deleted in Strapi", async () => {
    const { service, repo, strapi } = setup();
    repo.findSessionInEvent.mockResolvedValue(sessionRow);
    strapi.updateSessionDetail
      .mockResolvedValueOnce(null) // doc-1 is gone
      .mockResolvedValueOnce({ ...detail, documentId: "doc-new" });

    await service.updateContent(
      eventId,
      sessionId,
      update({ prerequisites: "Know some JS" }),
      organizer,
    );

    expect(repo.setCmsSessionId).toHaveBeenCalledWith(sessionId, "doc-new");
    expect(strapi.updateSessionDetail).toHaveBeenLastCalledWith("doc-new", {
      prerequisites: "Know some JS",
    });
  });

  it("answers 503 and relinks nothing when Strapi is down", async () => {
    const { service, repo, strapi } = setup();
    repo.findSessionInEvent.mockResolvedValue(sessionRow);
    strapi.updateSessionDetail.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(
      service.updateContent(
        eventId,
        sessionId,
        update({ prerequisites: "x" }),
        organizer,
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableError);
    expect(repo.setCmsSessionId).not.toHaveBeenCalled();
  });
});

const upload = () => ({
  body: new Blob([new Uint8Array(100)]).stream(),
  contentType: "multipart/form-data; boundary=abc",
});

/** The cover the session has before an upload replaces it (Strapi file 9). */
const oldCover = { ...cover, id: 9, url: "http://cms.test/uploads/old.jpg" };

describe("sessionService.replaceCover", () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => errorSpy.mockRestore());

  /** A session with a linked entry that has an old cover; uploads and saves succeed. */
  function coverSetup() {
    const ctx = setup();
    ctx.repo.findSessionInEvent.mockResolvedValue(sessionRow);
    ctx.strapi.findSessionDetailById.mockResolvedValue({
      ...detail,
      coverImage: oldCover,
    });
    ctx.strapi.updateSessionDetail.mockResolvedValue({
      ...detail,
      coverImage: cover,
    });
    return ctx;
  }

  it("streams the file to Strapi, sets it as the cover, then removes the old file", async () => {
    const { service, access, media, strapi } = coverSetup();

    const result = await service.replaceCover(
      eventId,
      sessionId,
      upload(),
      organizer,
    );

    expect(access.getEventIfOrgOwns).toHaveBeenCalledWith(eventId, organizer, {
      write: true,
    });
    expect(media.uploadFiles).toHaveBeenCalledWith(
      expect.any(ReadableStream),
      "multipart/form-data; boundary=abc",
    );
    expect(strapi.updateSessionDetail).toHaveBeenCalledWith("doc-1", {
      coverImage: 31,
    });
    expect(media.deleteFile).toHaveBeenCalledWith(9);
    expect(media.deleteFile).not.toHaveBeenCalledWith(31);
    expect(result).toEqual({ coverImage: cover });
  });

  it("deletes nothing old when the session had no cover", async () => {
    const { service, strapi, media } = coverSetup();
    strapi.findSessionDetailById.mockResolvedValue(detail);

    await service.replaceCover(eventId, sessionId, upload(), organizer);

    expect(media.deleteFile).not.toHaveBeenCalled();
  });

  it("answers 404 for someone else's event before a single byte goes to Strapi", async () => {
    const { service, access, media } = coverSetup();
    access.getEventIfOrgOwns.mockRejectedValue(
      new NotFoundError("Event not found"),
    );

    await expect(
      service.replaceCover(eventId, sessionId, upload(), organizer),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(media.uploadFiles).not.toHaveBeenCalled();
  });

  it("answers 404 for a session of another event before a single byte goes to Strapi", async () => {
    const { service, repo, media } = coverSetup();
    repo.findSessionInEvent.mockResolvedValue(null);

    await expect(
      service.replaceCover(eventId, sessionId, upload(), organizer),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(media.uploadFiles).not.toHaveBeenCalled();
  });

  it("answers 400 and deletes the file when Strapi stored something that is not an acceptable image", async () => {
    const { service, media, strapi } = coverSetup();
    media.uploadFiles.mockResolvedValue({
      ok: true,
      files: [{ ...newFile, mime: "application/pdf" }],
    });

    await expect(
      service.replaceCover(eventId, sessionId, upload(), organizer),
    ).rejects.toMatchObject({ status: 400 });
    expect(media.deleteFile).toHaveBeenCalledWith(31);
    expect(strapi.updateSessionDetail).not.toHaveBeenCalled();
  });

  it("answers 400 when Strapi refuses the file itself", async () => {
    const { service, media } = coverSetup();
    media.uploadFiles.mockResolvedValue({ ok: false, status: 415 });

    await expect(
      service.replaceCover(eventId, sessionId, upload(), organizer),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("removes the NEW file and keeps the old one when saving the cover fails", async () => {
    const { service, strapi, media } = coverSetup();
    strapi.updateSessionDetail.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(
      service.replaceCover(eventId, sessionId, upload(), organizer),
    ).rejects.toBeInstanceOf(ServiceUnavailableError);
    expect(media.deleteFile).toHaveBeenCalledWith(31);
    expect(media.deleteFile).not.toHaveBeenCalledWith(9);
  });

  it("creates and links an entry first when the session has none yet", async () => {
    const { service, repo, strapi } = coverSetup();
    repo.findSessionInEvent.mockResolvedValue({
      ...sessionRow,
      cmsSessionId: null,
    });
    strapi.updateSessionDetail.mockResolvedValue({
      ...detail,
      documentId: "doc-new",
      coverImage: cover,
    });

    await service.replaceCover(eventId, sessionId, upload(), organizer);

    expect(repo.setCmsSessionId).toHaveBeenCalledWith(sessionId, "doc-new");
    expect(strapi.updateSessionDetail).toHaveBeenCalledWith("doc-new", {
      coverImage: 31,
    });
  });
});

describe("sessionService.removeCover", () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => errorSpy.mockRestore());

  it("clears the cover in Strapi, then deletes the file", async () => {
    const { service, access, repo, strapi, media } = setup();
    repo.findSessionInEvent.mockResolvedValue(sessionRow);
    strapi.findSessionDetailById.mockResolvedValue({
      ...detail,
      coverImage: oldCover,
    });
    strapi.updateSessionDetail.mockResolvedValue(detail);

    const result = await service.removeCover(eventId, sessionId, organizer);

    expect(access.getEventIfOrgOwns).toHaveBeenCalledWith(eventId, organizer, {
      write: true,
    });
    expect(strapi.updateSessionDetail).toHaveBeenCalledWith("doc-1", {
      coverImage: null,
    });
    expect(media.deleteFile).toHaveBeenCalledWith(9);
    expect(result).toEqual({ coverImage: null });
  });

  it("is not an error when there is no cover: nothing changes", async () => {
    const { service, repo, strapi, media } = setup();
    repo.findSessionInEvent.mockResolvedValue(sessionRow);
    strapi.findSessionDetailById.mockResolvedValue(detail);

    await expect(
      service.removeCover(eventId, sessionId, organizer),
    ).resolves.toEqual({ coverImage: null });
    expect(strapi.updateSessionDetail).not.toHaveBeenCalled();
    expect(media.deleteFile).not.toHaveBeenCalled();
  });

  it("answers 404 for a session of another event and touches nothing", async () => {
    const { service, strapi, media } = setup();

    await expect(
      service.removeCover(eventId, sessionId, organizer),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(strapi.updateSessionDetail).not.toHaveBeenCalled();
    expect(media.deleteFile).not.toHaveBeenCalled();
  });
});

describe("sessionService.updateSession", () => {
  const edit = (body: UpdateSessionRequest) =>
    updateSessionBodySchema.parse(body);

  /** The session as saved: in person in `hallId`, 04:30-05:30 UTC on 12 Dec, inside the event. */
  function editSetup() {
    const ctx = setup();
    ctx.repo.findSessionInEvent.mockResolvedValue(sessionRow);
    return ctx;
  }

  const run = (
    service: ReturnType<typeof setup>["service"],
    body: UpdateSessionRequest,
    actor: typeof organizer | typeof admin = organizer,
  ) => service.updateSession(eventId, sessionId, edit(body), actor);

  describe("what changes", () => {
    it("writes only the fields that were sent, and answers the saved session", async () => {
      const { service, access, repo } = editSetup();

      const dto = await run(service, { title: "A better title" });

      expect(access.getEventIfOrgOwns).toHaveBeenCalledWith(
        eventId,
        organizer,
        {
          write: true,
        },
      );
      expect(repo.updateSession).toHaveBeenCalledWith(sessionId, {
        title: "A better title",
      });
      expect(() => sessionResponseSchema.parse(dto)).not.toThrow();
      expect(dto.title).toBe("A better title");
      expect(dto).not.toHaveProperty("cmsSessionId");
    });

    it("does not look at the hall or the speakers at all when only a title changes", async () => {
      const { service, repo, hallBooking, speakerBooking } = editSetup();

      await run(service, { title: "A better title" });

      expect(repo.findHall).not.toHaveBeenCalled();
      expect(hallBooking.assertHallFree).not.toHaveBeenCalled();
      expect(speakerBooking.assertSpeakersFree).not.toHaveBeenCalled();
      expect(repo.countActiveBookings).not.toHaveBeenCalled();
    });

    it("lets an admin edit (SESSION_MANAGE reaches any event)", async () => {
      const { service, repo } = editSetup();

      await run(service, { price: 49900 }, admin);

      expect(repo.updateSession).toHaveBeenCalledWith(sessionId, {
        price: 49900,
      });
    });

    it("treats the same time sent again as no change: no hall check", async () => {
      const { service, hallBooking } = editSetup();

      await run(service, {
        startAt: "2026-12-12T10:00:00+05:30", // 04:30 UTC, the saved start
        title: "Same slot",
      });

      expect(hallBooking.assertHallFree).not.toHaveBeenCalled();
    });

    it("answers 404 if the session vanished between the read and the write", async () => {
      const { service, repo } = editSetup();
      repo.updateSession.mockResolvedValue(null);

      await expect(run(service, { title: "Gone" })).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });

  describe("moving it", () => {
    it("checks the hall for the NEW slot and ignores the session's own old slot", async () => {
      const { service, hallBooking, repo } = editSetup();

      await run(service, {
        startAt: "2026-12-12T11:00:00+05:30", // 05:30 UTC
        endAt: "2026-12-12T12:00:00+05:30", // 06:30 UTC
      });

      expect(hallBooking.assertHallFree).toHaveBeenCalledWith({
        hallId,
        startAt: new Date("2026-12-12T05:30:00.000Z"),
        endAt: new Date("2026-12-12T06:30:00.000Z"),
        exceptSessionId: sessionId,
      });
      expect(repo.updateSession).toHaveBeenCalledWith(sessionId, {
        startAt: new Date("2026-12-12T05:30:00.000Z"),
        endAt: new Date("2026-12-12T06:30:00.000Z"),
      });
    });

    it("answers 409 HALL_BUSY and writes nothing when another session holds the hall", async () => {
      const { service, hallBooking, repo } = editSetup();
      hallBooking.assertHallFree.mockRejectedValue(
        new ConflictError("HALL_BUSY", "This hall is already booked"),
      );

      await expect(
        run(service, {
          startAt: "2026-12-12T11:00:00+05:30",
          endAt: "2026-12-12T12:00:00+05:30",
        }),
      ).rejects.toMatchObject({ code: "HALL_BUSY" });
      expect(repo.updateSession).not.toHaveBeenCalled();
    });

    it("checks the session's speakers for the NEW slot and ignores the session's own old slot", async () => {
      const { service, speakerBooking } = editSetup();

      await run(service, {
        startAt: "2026-12-12T11:00:00+05:30", // 05:30 UTC
        endAt: "2026-12-12T12:00:00+05:30", // 06:30 UTC
      });

      expect(speakerBooking.assertSpeakersFree).toHaveBeenCalledWith({
        speakerIds: [speakerId],
        startAt: new Date("2026-12-12T05:30:00.000Z"),
        endAt: new Date("2026-12-12T06:30:00.000Z"),
        exceptSessionId: sessionId,
      });
    });

    it("answers 409 SPEAKER_BUSY and writes nothing when a speaker is busy in the new slot", async () => {
      const { service, speakerBooking, repo } = editSetup();
      speakerBooking.assertSpeakersFree.mockRejectedValue(
        new ConflictError("SPEAKER_BUSY", "Anna Rao is already booked"),
      );

      await expect(
        run(service, {
          startAt: "2026-12-12T11:00:00+05:30",
          endAt: "2026-12-12T12:00:00+05:30",
        }),
      ).rejects.toMatchObject({ code: "SPEAKER_BUSY" });
      expect(repo.updateSession).not.toHaveBeenCalled();
    });

    it("does not ask about the speakers when only the hall changes: the time is the same", async () => {
      const { service, repo, speakerBooking } = editSetup();
      repo.findHall.mockResolvedValue({
        id: "7d8e9f0a-1b2c-4d3e-8f4a-5b6c7d8e9f0a",
        venueId,
        isActive: true,
        capacity: 100,
      });

      await run(service, { hallId: "7d8e9f0a-1b2c-4d3e-8f4a-5b6c7d8e9f0a" });

      expect(speakerBooking.assertSpeakersFree).not.toHaveBeenCalled();
    });

    it("moves the session to another hall of the same venue", async () => {
      const { service, repo, hallBooking } = editSetup();
      const otherHall = "7d8e9f0a-1b2c-4d3e-8f4a-5b6c7d8e9f0a";
      repo.findHall.mockResolvedValue({
        id: otherHall,
        venueId,
        isActive: true,
        capacity: 100,
      });

      await run(service, { hallId: otherHall });

      expect(hallBooking.assertHallFree).toHaveBeenCalledWith(
        expect.objectContaining({
          hallId: otherHall,
          exceptSessionId: sessionId,
        }),
      );
      expect(repo.updateSession).toHaveBeenCalledWith(sessionId, {
        hallId: otherHall,
      });
    });

    it("answers 404 for a hall of another venue, the same as a missing one", async () => {
      const { service, repo } = editSetup();
      repo.findHall.mockResolvedValue({
        id: hallId,
        venueId: "0d9c8b7a-6f5e-4d3c-8b2a-1f0e9d8c7b6a",
        isActive: true,
        capacity: 100,
      });

      await expect(
        run(service, { hallId: "7d8e9f0a-1b2c-4d3e-8f4a-5b6c7d8e9f0a" }),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(repo.updateSession).not.toHaveBeenCalled();
    });

    it("answers 409 HALL_INACTIVE for a retired hall", async () => {
      const { service, repo } = editSetup();
      repo.findHall.mockResolvedValue({
        id: hallId,
        venueId,
        isActive: false,
        capacity: 100,
      });

      await expect(
        run(service, { hallId: "7d8e9f0a-1b2c-4d3e-8f4a-5b6c7d8e9f0a" }),
      ).rejects.toMatchObject({ code: "HALL_INACTIVE" });
    });

    it("refuses a new time outside the event's dates (400) before touching the hall", async () => {
      const { service, hallBooking } = editSetup();

      await expect(
        run(service, {
          startAt: "2026-12-12T09:00:00+05:30", // 03:30 UTC, before the event
          endAt: "2026-12-12T11:00:00+05:30",
        }),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(hallBooking.assertHallFree).not.toHaveBeenCalled();
    });
  });

  describe("the merged session must be valid", () => {
    it("refuses an end that is not after the start (400)", async () => {
      const { service, repo } = editSetup();

      await expect(
        run(service, { endAt: "2026-12-12T09:00:00+05:30" }),
      ).rejects.toMatchObject({
        status: 400,
        message: "End must be after the start",
      });
      expect(repo.updateSession).not.toHaveBeenCalled();
    });

    it("refuses switching to online without clearing the hall (400): the client says it", async () => {
      const { service, repo } = editSetup();

      await expect(
        run(service, {
          mode: "online",
          onlineUrl: "https://meet.example.com/a",
        }),
      ).rejects.toMatchObject({
        status: 400,
        message: "An online session has no hall",
      });
      expect(repo.updateSession).not.toHaveBeenCalled();
    });

    it("switches to online when the hall is cleared and a link is given: no hall to check", async () => {
      const { service, repo, hallBooking } = editSetup();

      await run(service, {
        mode: "online",
        hallId: null,
        onlineUrl: "https://meet.example.com/a",
      });

      expect(hallBooking.assertHallFree).not.toHaveBeenCalled();
      expect(repo.updateSession).toHaveBeenCalledWith(sessionId, {
        mode: "online",
        hallId: null,
        onlineUrl: "https://meet.example.com/a",
      });
    });

    it("refuses an online session left without a link (400)", async () => {
      const { service } = editSetup();

      await expect(
        run(service, { mode: "online", hallId: null }),
      ).rejects.toMatchObject({ status: 400, message: "Add the join link" });
    });
  });

  describe("sessions that cannot be edited", () => {
    it("answers 409 SESSION_CANCELLED for a cancelled session", async () => {
      const { service, repo } = editSetup();
      repo.findSessionInEvent.mockResolvedValue({
        ...sessionRow,
        status: "cancelled",
        cancelledAt: new Date("2026-11-02T10:00:00.000Z"),
      });

      await expect(run(service, { title: "Nope" })).rejects.toMatchObject({
        code: "SESSION_CANCELLED",
      });
      expect(repo.updateSession).not.toHaveBeenCalled();
    });

    it("answers 409 SESSION_ENDED for a session that is already over", async () => {
      const { service, repo } = editSetup();
      repo.findSessionInEvent.mockResolvedValue({
        ...sessionRow,
        startAt: new Date("2026-11-01T10:00:00.000Z"),
        endAt: new Date("2026-11-01T11:00:00.000Z"), // before NOW
      });

      await expect(run(service, { title: "Too late" })).rejects.toMatchObject({
        code: "SESSION_ENDED",
      });
      expect(repo.updateSession).not.toHaveBeenCalled();
    });

    it("answers 409 for a cancelled event", async () => {
      const { service, access } = editSetup();
      access.getEventIfOrgOwns.mockRejectedValue(
        new ConflictError(
          "EVENT_CANCELLED",
          "A cancelled event can no longer be edited",
        ),
      );

      await expect(run(service, { title: "Nope" })).rejects.toMatchObject({
        code: "EVENT_CANCELLED",
      });
    });

    it("answers 404 for someone else's event and reads no session", async () => {
      const { service, access, repo } = editSetup();
      access.getEventIfOrgOwns.mockRejectedValue(
        new NotFoundError("Event not found"),
      );

      await expect(run(service, { title: "Nope" })).rejects.toBeInstanceOf(
        NotFoundError,
      );
      expect(repo.findSessionInEvent).not.toHaveBeenCalled();
    });

    it("answers 404 for a session that is not in this event", async () => {
      const { service, repo } = setup();

      await expect(run(service, { title: "Nope" })).rejects.toBeInstanceOf(
        NotFoundError,
      );
      expect(repo.updateSession).not.toHaveBeenCalled();
    });
  });

  describe("bookings", () => {
    const booked = { ...sessionRow, requiresRegistration: true };

    it("refuses to stop requiring registration once seats are booked (409)", async () => {
      const { service, repo } = editSetup();
      repo.findSessionInEvent.mockResolvedValue(booked);
      repo.countActiveBookings.mockResolvedValue(3);

      await expect(
        run(service, { requiresRegistration: false }),
      ).rejects.toMatchObject({ code: "SESSION_HAS_BOOKINGS" });
      expect(repo.updateSession).not.toHaveBeenCalled();
    });

    it("lets it stop requiring registration while nobody has booked", async () => {
      const { service, repo } = editSetup();
      repo.findSessionInEvent.mockResolvedValue(booked);

      await run(service, { requiresRegistration: false });

      expect(repo.updateSession).toHaveBeenCalledWith(sessionId, {
        requiresRegistration: false,
      });
    });

    it("refuses a move to a hall with fewer seats than are booked (409)", async () => {
      const { service, repo } = editSetup();
      repo.findSessionInEvent.mockResolvedValue(booked);
      repo.countActiveBookings.mockResolvedValue(30);
      repo.findHall.mockResolvedValue({
        id: "7d8e9f0a-1b2c-4d3e-8f4a-5b6c7d8e9f0a",
        venueId,
        isActive: true,
        capacity: 20,
      });

      await expect(
        run(service, { hallId: "7d8e9f0a-1b2c-4d3e-8f4a-5b6c7d8e9f0a" }),
      ).rejects.toMatchObject({ code: "HALL_TOO_SMALL" });
    });

    it("allows a move to a hall that still seats everyone booked", async () => {
      const { service, repo } = editSetup();
      repo.findSessionInEvent.mockResolvedValue(booked);
      repo.countActiveBookings.mockResolvedValue(20);
      repo.findHall.mockResolvedValue({
        id: "7d8e9f0a-1b2c-4d3e-8f4a-5b6c7d8e9f0a",
        venueId,
        isActive: true,
        capacity: 20,
      });

      await expect(
        run(service, { hallId: "7d8e9f0a-1b2c-4d3e-8f4a-5b6c7d8e9f0a" }),
      ).resolves.toBeDefined();
    });

    it("does not compare seats for a session that needs no booking", async () => {
      const { service, repo } = editSetup();
      repo.countActiveBookings.mockResolvedValue(30);
      repo.findHall.mockResolvedValue({
        id: "7d8e9f0a-1b2c-4d3e-8f4a-5b6c7d8e9f0a",
        venueId,
        isActive: true,
        capacity: 10,
      });

      await expect(
        run(service, { hallId: "7d8e9f0a-1b2c-4d3e-8f4a-5b6c7d8e9f0a" }),
      ).resolves.toBeDefined();
    });
  });
});

describe("sessionService.replaceSpeakers", () => {
  const replace = (
    service: ReturnType<typeof setup>["service"],
    body: ReplaceSessionSpeakersRequest,
    actor: typeof organizer | typeof admin = organizer,
  ) =>
    service.replaceSpeakers(
      eventId,
      sessionId,
      replaceSessionSpeakersBodySchema.parse(body),
      actor,
    );

  function replaceSetup() {
    const ctx = setup();
    ctx.repo.findSessionInEvent.mockResolvedValue(sessionRow);
    return ctx;
  }

  it("replaces the list, keeping the order and roles, and answers the session with its new speakers", async () => {
    const { service, access, repo } = replaceSetup();

    const dto = await replace(service, {
      speakers: [
        { speakerId: moderatorId, role: "moderator" },
        { speakerId, role: "speaker" },
      ],
    });

    expect(access.getEventIfOrgOwns).toHaveBeenCalledWith(eventId, organizer, {
      write: true,
    });
    expect(repo.replaceSessionSpeakers).toHaveBeenCalledWith(sessionId, [
      { speakerId: moderatorId, role: "moderator" },
      { speakerId, role: "speaker" },
    ]);
    expect(() => sessionResponseSchema.parse(dto)).not.toThrow();
    expect(dto.speakers).toEqual([
      {
        speakerId: moderatorId,
        name: "Speaker Name",
        role: "moderator",
        displayOrder: 0,
      },
      { speakerId, name: "Speaker Name", role: "speaker", displayOrder: 1 },
    ]);
  });

  it("checks only the speakers who are NEW to the session, against its current slot", async () => {
    const { service, speakerBooking } = replaceSetup();

    // The session has `speakerId` already; the moderator is new.
    await replace(service, {
      speakers: [
        { speakerId, role: "speaker" },
        { speakerId: moderatorId, role: "moderator" },
      ],
    });

    expect(speakerBooking.assertSpeakersFree).toHaveBeenCalledWith({
      speakerIds: [moderatorId],
      startAt: new Date("2026-12-12T04:30:00.000Z"),
      endAt: new Date("2026-12-12T05:30:00.000Z"),
      exceptSessionId: sessionId,
    });
  });

  it("answers 409 SPEAKER_BUSY and writes nothing when a new speaker is busy at that time", async () => {
    const { service, speakerBooking, repo } = replaceSetup();
    speakerBooking.assertSpeakersFree.mockRejectedValue(
      new ConflictError("SPEAKER_BUSY", "Ben Lee is already booked"),
    );

    await expect(
      replace(service, { speakers: [{ speakerId: moderatorId }] }),
    ).rejects.toMatchObject({ status: 409, code: "SPEAKER_BUSY" });
    expect(repo.replaceSessionSpeakers).not.toHaveBeenCalled();
  });

  it("has nobody to clash with while the session has no time yet", async () => {
    const { service, repo, speakerBooking } = replaceSetup();
    repo.findSessionInEvent.mockResolvedValue({
      ...sessionRow,
      status: "draft",
      startAt: null,
      endAt: null,
    });

    await replace(service, { speakers: [{ speakerId: moderatorId }] });

    expect(speakerBooking.assertSpeakersFree).not.toHaveBeenCalled();
    expect(repo.replaceSessionSpeakers).toHaveBeenCalled();
  });

  it("lets an admin change the speakers (SESSION_MANAGE reaches any event)", async () => {
    const { service, repo } = replaceSetup();

    await replace(service, { speakers: [{ speakerId }] }, admin);

    expect(repo.replaceSessionSpeakers).toHaveBeenCalled();
  });

  it("refuses an id that is not a speaker profile (400), e.g. a user id, and writes nothing", async () => {
    const { service, repo } = replaceSetup();
    repo.findExistingSpeakerIds.mockResolvedValue([]);

    await expect(
      replace(service, { speakers: [{ speakerId }] }),
    ).rejects.toMatchObject({
      status: 400,
      details: { speakerIds: [speakerId] },
    });
    expect(repo.replaceSessionSpeakers).not.toHaveBeenCalled();
  });

  it("leaves the Strapi content alone", async () => {
    const { service, strapi, media } = replaceSetup();

    await replace(service, { speakers: [{ speakerId }] });

    expect(strapi.updateSessionDetail).not.toHaveBeenCalled();
    expect(strapi.createSessionDetail).not.toHaveBeenCalled();
    expect(media.deleteFile).not.toHaveBeenCalled();
  });

  it("answers 409 SESSION_CANCELLED for a cancelled session", async () => {
    const { service, repo } = replaceSetup();
    repo.findSessionInEvent.mockResolvedValue({
      ...sessionRow,
      status: "cancelled",
      cancelledAt: new Date("2026-11-02T10:00:00.000Z"),
    });

    await expect(
      replace(service, { speakers: [{ speakerId }] }),
    ).rejects.toMatchObject({ code: "SESSION_CANCELLED" });
    expect(repo.replaceSessionSpeakers).not.toHaveBeenCalled();
  });

  it("answers 409 SESSION_ENDED for a session that is already over", async () => {
    const { service, repo } = replaceSetup();
    repo.findSessionInEvent.mockResolvedValue({
      ...sessionRow,
      startAt: new Date("2026-11-01T10:00:00.000Z"),
      endAt: new Date("2026-11-01T11:00:00.000Z"), // before NOW
    });

    await expect(
      replace(service, { speakers: [{ speakerId }] }),
    ).rejects.toMatchObject({ code: "SESSION_ENDED" });
  });

  it("answers 409 for a cancelled event", async () => {
    const { service, access } = replaceSetup();
    access.getEventIfOrgOwns.mockRejectedValue(
      new ConflictError(
        "EVENT_CANCELLED",
        "A cancelled event can no longer be edited",
      ),
    );

    await expect(
      replace(service, { speakers: [{ speakerId }] }),
    ).rejects.toMatchObject({ code: "EVENT_CANCELLED" });
  });

  it("answers 404 for someone else's event and reads no session", async () => {
    const { service, access, repo } = replaceSetup();
    access.getEventIfOrgOwns.mockRejectedValue(
      new NotFoundError("Event not found"),
    );

    await expect(
      replace(service, { speakers: [{ speakerId }] }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(repo.findSessionInEvent).not.toHaveBeenCalled();
  });

  it("answers 404 for a session that is not in this event", async () => {
    const { service, repo } = setup();

    await expect(
      replace(service, { speakers: [{ speakerId }] }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(repo.replaceSessionSpeakers).not.toHaveBeenCalled();
  });

  it("answers 404 if the session vanished between the read and the write", async () => {
    const { service, repo } = replaceSetup();
    repo.replaceSessionSpeakers.mockResolvedValue(null);

    await expect(
      replace(service, { speakers: [{ speakerId }] }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("sessionService.cancelSession", () => {
  function cancelSetup() {
    const ctx = setup();
    ctx.repo.findSessionInEvent.mockResolvedValue(sessionRow);
    return ctx;
  }

  it("cancels the session at the current time and answers it as cancelled", async () => {
    const { service, access, repo } = cancelSetup();

    const dto = await service.cancelSession(eventId, sessionId, organizer);

    expect(access.getEventIfOrgOwns).toHaveBeenCalledWith(eventId, organizer, {
      write: true,
    });
    expect(repo.cancelSession).toHaveBeenCalledWith(sessionId, NOW);
    expect(() => sessionResponseSchema.parse(dto)).not.toThrow();
    expect(dto.status).toBe("cancelled");
    expect(dto).not.toHaveProperty("cancelledAt");
    expect(dto).not.toHaveProperty("cmsSessionId");
  });

  it("lets an admin cancel (SESSION_MANAGE reaches any event)", async () => {
    const { service, repo } = cancelSetup();

    await service.cancelSession(eventId, sessionId, admin);

    expect(repo.cancelSession).toHaveBeenCalledWith(sessionId, NOW);
  });

  it("leaves the Strapi content and the speakers alone", async () => {
    const { service, strapi, media } = cancelSetup();

    await service.cancelSession(eventId, sessionId, organizer);

    expect(strapi.deleteSessionDetail).not.toHaveBeenCalled();
    expect(strapi.updateSessionDetail).not.toHaveBeenCalled();
    expect(media.deleteFile).not.toHaveBeenCalled();
  });

  it("answers a session that is already cancelled as it is, without writing again", async () => {
    const { service, repo } = cancelSetup();
    repo.findSessionInEvent.mockResolvedValue({
      ...sessionRow,
      status: "cancelled",
      cancelledAt: new Date("2026-11-02T10:00:00.000Z"),
    });

    const dto = await service.cancelSession(eventId, sessionId, organizer);

    expect(dto.status).toBe("cancelled");
    expect(repo.cancelSession).not.toHaveBeenCalled();
  });

  it("answers the cancelled session too when someone else cancelled it a moment earlier", async () => {
    const { service, repo } = cancelSetup();
    repo.cancelSession.mockResolvedValue(null);
    repo.findSessionInEvent
      .mockResolvedValueOnce(sessionRow) // still scheduled when we first looked
      .mockResolvedValueOnce({
        ...sessionRow,
        status: "cancelled",
        cancelledAt: new Date("2026-11-03T09:59:59.000Z"),
      });

    const dto = await service.cancelSession(eventId, sessionId, organizer);

    expect(dto.status).toBe("cancelled");
  });

  it("answers 409 SESSION_ENDED for a session that is already over", async () => {
    const { service, repo } = cancelSetup();
    repo.findSessionInEvent.mockResolvedValue({
      ...sessionRow,
      startAt: new Date("2026-11-01T10:00:00.000Z"),
      endAt: new Date("2026-11-01T11:00:00.000Z"), // before NOW
    });

    await expect(
      service.cancelSession(eventId, sessionId, organizer),
    ).rejects.toMatchObject({ code: "SESSION_ENDED" });
    expect(repo.cancelSession).not.toHaveBeenCalled();
  });

  it("answers 409 for a cancelled event", async () => {
    const { service, access, repo } = cancelSetup();
    access.getEventIfOrgOwns.mockRejectedValue(
      new ConflictError(
        "EVENT_CANCELLED",
        "A cancelled event can no longer be edited",
      ),
    );

    await expect(
      service.cancelSession(eventId, sessionId, organizer),
    ).rejects.toMatchObject({ code: "EVENT_CANCELLED" });
    expect(repo.cancelSession).not.toHaveBeenCalled();
  });

  it("answers 404 for someone else's event and reads no session", async () => {
    const { service, access, repo } = cancelSetup();
    access.getEventIfOrgOwns.mockRejectedValue(
      new NotFoundError("Event not found"),
    );

    await expect(
      service.cancelSession(eventId, sessionId, organizer),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(repo.findSessionInEvent).not.toHaveBeenCalled();
  });

  it("answers 404 for a session that is not in this event and cancels nothing", async () => {
    const { service, repo } = setup();

    await expect(
      service.cancelSession(eventId, sessionId, organizer),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(repo.cancelSession).not.toHaveBeenCalled();
  });
});

describe("two saves for one hall at the same moment (the database constraint)", () => {
  /** The database refusing the overlap, as Drizzle wraps the driver's error. */
  const clash = () =>
    new DrizzleQueryError(
      "insert into sessions ...",
      [],
      Object.assign(
        new Error("conflicting key value violates exclusion constraint"),
        {
          code: "23P01",
          constraint: HALL_OVERLAP_CONSTRAINT,
        },
      ),
    );
  /** What the normal check says once the other session is saved: 409 with the busy time. */
  const busy = () =>
    new ConflictError("HALL_BUSY", "This hall is already booked", {
      conflicts: [
        {
          startAt: "2026-12-12T04:30:00.000Z",
          endAt: "2026-12-12T05:30:00.000Z",
        },
      ],
    });

  let errorSpy: jest.SpyInstance;
  beforeEach(() => {
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => errorSpy.mockRestore());

  describe("creating", () => {
    it("answers 409 HALL_BUSY with the busy times, like the normal check, and removes the Strapi draft", async () => {
      const { service, repo, hallBooking, strapi } = setup();
      repo.createSession.mockRejectedValue(clash());
      // The check before the save passed (the hall looked free); asked again, it is busy.
      hallBooking.assertHallFree
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(busy());

      await expect(
        service.createSession(eventId, parse(), organizer),
      ).rejects.toMatchObject({
        code: "HALL_BUSY",
        details: {
          conflicts: [expect.objectContaining({ startAt: expect.any(String) })],
        },
      });
      expect(hallBooking.assertHallFree).toHaveBeenCalledTimes(2);
      expect(strapi.deleteSessionDetail).toHaveBeenCalledWith("doc-new");
    });

    it("still answers 409 HALL_BUSY when the other session is already gone by the second look", async () => {
      const { service, repo } = setup();
      repo.createSession.mockRejectedValue(clash());

      await expect(
        service.createSession(eventId, parse(), organizer),
      ).rejects.toMatchObject({
        code: "HALL_BUSY",
        message: expect.stringContaining("just booked"),
      });
    });

    it("does not turn other database errors into a hall clash", async () => {
      const { service, repo, hallBooking } = setup();
      const failure = new Error("insert failed");
      repo.createSession.mockRejectedValue(failure);

      await expect(
        service.createSession(eventId, parse(), organizer),
      ).rejects.toBe(failure);
      expect(hallBooking.assertHallFree).toHaveBeenCalledTimes(1); // only the check before
    });

    it("does not turn an overlap error on an online session (no hall) into a hall clash", async () => {
      const { service, repo } = setup();
      const failure = clash();
      repo.createSession.mockRejectedValue(failure);

      await expect(
        service.createSession(
          eventId,
          parse({
            mode: "online",
            hallId: undefined,
            onlineUrl: "https://meet.example.com/abc",
          }),
          organizer,
        ),
      ).rejects.toBe(failure);
    });
  });

  describe("editing", () => {
    const moveBody = updateSessionBodySchema.parse({
      startAt: "2026-12-12T11:00:00+05:30",
      endAt: "2026-12-12T12:00:00+05:30",
    });

    it("answers 409 HALL_BUSY with the busy times, ignoring the session's own old slot", async () => {
      const { service, repo, hallBooking } = setup();
      repo.findSessionInEvent.mockResolvedValue(sessionRow);
      repo.updateSession.mockRejectedValue(clash());
      hallBooking.assertHallFree
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(busy());

      await expect(
        service.updateSession(eventId, sessionId, moveBody, organizer),
      ).rejects.toMatchObject({ code: "HALL_BUSY" });
      expect(hallBooking.assertHallFree).toHaveBeenLastCalledWith(
        expect.objectContaining({ hallId, exceptSessionId: sessionId }),
      );
    });

    it("still answers 409 HALL_BUSY when the other session is already gone by the second look", async () => {
      const { service, repo } = setup();
      repo.findSessionInEvent.mockResolvedValue(sessionRow);
      repo.updateSession.mockRejectedValue(clash());

      await expect(
        service.updateSession(eventId, sessionId, moveBody, organizer),
      ).rejects.toMatchObject({
        code: "HALL_BUSY",
        message: expect.stringContaining("just booked"),
      });
    });

    it("does not turn other database errors into a hall clash", async () => {
      const { service, repo } = setup();
      repo.findSessionInEvent.mockResolvedValue(sessionRow);
      const failure = new Error("update failed");
      repo.updateSession.mockRejectedValue(failure);

      await expect(
        service.updateSession(eventId, sessionId, moveBody, organizer),
      ).rejects.toBe(failure);
    });
  });
});

// A multi-day event is one range (start of the first day to end of the last), but its start and end
// times also say when each day runs: 09:00-17:00 here, 3 to 5 Dec 2026. The service holds every
// session to those daily hours, as long as the event does not run through the night.
describe("sessionService: the event's daily hours", () => {
  // 09:00 IST on 3 Dec to 17:00 IST on 5 Dec.
  const multiDay = {
    ...event,
    startAt: new Date("2026-12-03T03:30:00.000Z"),
    endAt: new Date("2026-12-05T11:30:00.000Z"),
  };
  // 18:00 IST on 3 Dec to 10:00 IST on 4 Dec: a night, with no daily hours.
  const overnight = {
    ...event,
    startAt: new Date("2026-12-03T12:30:00.000Z"),
    endAt: new Date("2026-12-04T04:30:00.000Z"),
  };
  const create = (eventRow: typeof event, startAt: string, endAt: string) => {
    const { service, repo } = setup(eventRow);
    return {
      repo,
      result: service.createSession(
        eventId,
        createSessionBodySchema.parse({ ...inPerson, startAt, endAt }),
        organizer,
      ),
    };
  };

  describe("creating", () => {
    it("refuses a session that ends after the event closes for the day (400)", async () => {
      // 4 Dec is the middle day: inside the range, but after 17:00.
      const { result, repo } = create(
        multiDay,
        "2026-12-04T16:00:00+05:30",
        "2026-12-04T18:00:00+05:30",
      );

      await expect(result).rejects.toMatchObject({
        status: 400,
        message:
          "Sessions must take place between 09:00 and 17:00 on each day of the event",
      });
      expect(repo.createSession).not.toHaveBeenCalled();
    });

    it("refuses a session on the first day that ends after the event closes for the day", async () => {
      const { result } = create(
        multiDay,
        "2026-12-03T16:00:00+05:30",
        "2026-12-03T18:00:00+05:30",
      );

      await expect(result).rejects.toBeInstanceOf(ValidationError);
    });

    it("refuses a session that starts before the event opens for the day (400)", async () => {
      const { result } = create(
        multiDay,
        "2026-12-04T08:00:00+05:30",
        "2026-12-04T10:00:00+05:30",
      );

      await expect(result).rejects.toBeInstanceOf(ValidationError);
    });

    it("refuses a session that runs past midnight into the next day", async () => {
      const { result } = create(
        multiDay,
        "2026-12-04T16:00:00+05:30",
        "2026-12-05T01:00:00+05:30",
      );

      await expect(result).rejects.toBeInstanceOf(ValidationError);
    });

    it("accepts a session that uses the whole day, from opening to closing", async () => {
      const { result } = create(
        multiDay,
        "2026-12-04T09:00:00+05:30",
        "2026-12-04T17:00:00+05:30",
      );

      await expect(result).resolves.toMatchObject({
        title: "Offline-first Event Apps",
      });
    });

    it("accepts a session inside the hours of a day in the middle of the event", async () => {
      const { result } = create(
        multiDay,
        "2026-12-04T13:00:00+05:30",
        "2026-12-04T14:00:00+05:30",
      );

      await expect(result).resolves.toBeDefined();
    });

    it("has no daily hours for an event that runs through the night", async () => {
      // 23:00 on 3 Dec to 01:00 on 4 Dec: late, and across midnight, but the event is overnight.
      const { result } = create(
        overnight,
        "2026-12-03T23:00:00+05:30",
        "2026-12-04T01:00:00+05:30",
      );

      await expect(result).resolves.toBeDefined();
    });

    it("still refuses a session outside an overnight event's own dates", async () => {
      const { result } = create(
        overnight,
        "2026-12-04T09:00:00+05:30",
        "2026-12-04T11:00:00+05:30", // after the event ends at 10:00
      );

      await expect(result).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe("editing", () => {
    const saved = {
      ...sessionRow,
      startAt: new Date("2026-12-04T05:30:00.000Z"), // 11:00 IST on 4 Dec
      endAt: new Date("2026-12-04T06:30:00.000Z"),
    };
    function edit(body: UpdateSessionRequest) {
      const { service, repo } = setup(multiDay);
      repo.findSessionInEvent.mockResolvedValue(saved);
      return {
        repo,
        result: service.updateSession(
          eventId,
          sessionId,
          updateSessionBodySchema.parse(body),
          organizer,
        ),
      };
    }

    it("refuses moving a session to after the event closes for the day (400)", async () => {
      const { result, repo } = edit({
        startAt: "2026-12-04T17:00:00+05:30",
        endAt: "2026-12-04T18:00:00+05:30",
      });

      await expect(result).rejects.toMatchObject({
        status: 400,
        message:
          "Sessions must take place between 09:00 and 17:00 on each day of the event",
      });
      expect(repo.updateSession).not.toHaveBeenCalled();
    });

    it("refuses stretching only the end past closing time", async () => {
      const { result } = edit({ endAt: "2026-12-04T18:00:00+05:30" });

      await expect(result).rejects.toBeInstanceOf(ValidationError);
    });

    it("lets a session move to another time inside the hours", async () => {
      const { result, repo } = edit({
        startAt: "2026-12-04T14:00:00+05:30",
        endAt: "2026-12-04T15:00:00+05:30",
      });

      await expect(result).resolves.toBeDefined();
      expect(repo.updateSession).toHaveBeenCalled();
    });

    it("does not hold an edit that leaves the time alone to the hours (a title change always works)", async () => {
      // A session saved before the rule, outside the hours: renaming it must still work.
      const { service, repo } = setup(multiDay);
      repo.findSessionInEvent.mockResolvedValue({
        ...saved,
        startAt: new Date("2026-12-04T12:00:00.000Z"), // 17:30 IST
        endAt: new Date("2026-12-04T13:00:00.000Z"),
      });

      await expect(
        service.updateSession(
          eventId,
          sessionId,
          updateSessionBodySchema.parse({ title: "A better title" }),
          organizer,
        ),
      ).resolves.toBeDefined();
    });
  });
});
