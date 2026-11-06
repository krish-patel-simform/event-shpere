import { NotFoundError } from "../../../../core/http/errors";
import type { CmsSessionDetail } from "../../../cms";
import { publicSessionDetailSchema } from "../../schemas/session-public.schemas";
import type { PublicSessionRow } from "../session.repository";
import { createSessionService } from "../session.service";

// Empty factories: the DB client, Strapi client and env are never loaded.
jest.mock("../session.repository", () => ({}));
jest.mock("../hall-booking.repository", () => ({}));
jest.mock("../../../cms/server", () =>
  jest.requireActual("../../../cms/server/image-upload"),
);
// Only the pure public image mapper is needed from the events feature.
jest.mock("../../../events/server", () =>
  jest.requireActual("../../../events/server/event.dto"),
);

const slug = "tech-conf-2026";
const sessionId = "8c1f4f6e-2f4b-4c43-9a59-0d6f2a1b7e10";

let errorSpy: jest.SpyInstance;
beforeEach(() => {
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => errorSpy.mockRestore());

/** A scheduled session of a published event, as the repository returns it. */
const row = (overrides: Partial<PublicSessionRow> = {}): PublicSessionRow => ({
  id: sessionId,
  title: "Offline-first Event Apps",
  type: "talk",
  mode: "in_person",
  startAt: new Date("2026-12-12T04:30:00.000Z"),
  endAt: new Date("2026-12-12T05:30:00.000Z"),
  price: 50_000,
  requiresRegistration: true,
  cmsSessionId: "doc-1",
  hallName: "Main Hall",
  event: {
    slug,
    title: "Tech Conf",
    status: "published",
    timezone: "Asia/Kolkata",
  },
  speakers: [
    { slug: "asha-rao", firstName: "Asha", lastName: "Rao", role: "speaker" },
  ],
  ...overrides,
});

const paragraph = (text: string) => ({
  type: "paragraph",
  children: [{ type: "text", text }],
});

const detail = (
  overrides: Partial<CmsSessionDetail> = {},
): CmsSessionDetail => ({
  documentId: "doc-1",
  description: [paragraph("First paragraph."), paragraph("Second paragraph.")],
  prerequisites: "Basic React",
  coverImage: {
    id: 9,
    url: "http://cms.test/uploads/cover.jpg",
    alt: "The hall",
    width: 1600,
    height: 900,
  },
  resources: [{ label: "Slides", url: "https://example.com/slides" }],
  ...overrides,
});

function setup(found: PublicSessionRow | null = row()) {
  const repo = {
    findHall: jest.fn(),
    findExistingSpeakerIds: jest.fn(),
    createSession: jest.fn(),
    listSessionsByEvent: jest.fn(),
    findSessionInEvent: jest.fn(),
    findPublicSession: jest.fn().mockResolvedValue(found),
    setCmsSessionId: jest.fn(),
    countActiveBookings: jest.fn(),
    updateSession: jest.fn(),
    cancelSession: jest.fn(),
    replaceSessionSpeakers: jest.fn(),
  };
  const strapi = {
    createSessionDetail: jest.fn(),
    deleteSessionDetail: jest.fn(),
    findSessionDetailById: jest.fn().mockResolvedValue(detail()),
    updateSessionDetail: jest.fn(),
  };
  const service = createSessionService({
    eventAccess: { getEventIfOrgOwns: jest.fn() },
    sessionRepository: repo,
    hallBooking: { assertHallFree: jest.fn() },
    speakerBooking: { assertSpeakersFree: jest.fn() },
    strapiClient: strapi,
    mediaClient: { uploadFiles: jest.fn(), deleteFile: jest.fn() },
  });
  return { service, repo, strapi };
}

describe("sessionService.getPublicSession", () => {
  it("looks the session up by the event's link AND the session id", async () => {
    const { service, repo } = setup();

    await service.getPublicSession(slug, sessionId);

    expect(repo.findPublicSession).toHaveBeenCalledWith(slug, sessionId);
  });

  it("is a 404 when the session is not public, and never asks Strapi", async () => {
    // Draft event, draft or cancelled session, another event's session: the query finds none.
    const { service, strapi } = setup(null);

    await expect(service.getPublicSession(slug, sessionId)).rejects.toThrow(
      NotFoundError,
    );
    expect(strapi.findSessionDetailById).not.toHaveBeenCalled();
  });

  it("answers the facts, the speakers and the written content", async () => {
    const { service, strapi } = setup();

    const dto = await service.getPublicSession(slug, sessionId);

    expect(strapi.findSessionDetailById).toHaveBeenCalledWith("doc-1");
    expect(dto).toMatchObject({
      id: sessionId,
      title: "Offline-first Event Apps",
      type: "talk",
      mode: "in_person",
      startAt: "2026-12-12T04:30:00.000Z",
      endAt: "2026-12-12T05:30:00.000Z",
      hallName: "Main Hall",
      price: 50_000,
      requiresRegistration: true,
      speakers: [{ slug: "asha-rao", name: "Asha Rao", role: "speaker" }],
      event: {
        slug,
        title: "Tech Conf",
        status: "published",
        timezone: "Asia/Kolkata",
      },
      content: {
        description: "First paragraph.\n\nSecond paragraph.",
        prerequisites: "Basic React",
        resources: [{ label: "Slides", url: "https://example.com/slides" }],
        // The Strapi file id (9) is not public.
        coverImage: {
          url: "http://cms.test/uploads/cover.jpg",
          alt: "The hall",
          width: 1600,
          height: 900,
        },
      },
    });
  });

  it("matches the response schema and leaks nothing internal", async () => {
    const { service } = setup(
      // Even if the row somehow carried these, the DTO picks fields one by one.
      row({ cmsSessionId: "doc-1" }),
    );

    const dto = await service.getPublicSession(slug, sessionId);

    expect(() => publicSessionDetailSchema.parse(dto)).not.toThrow();
    expect(dto).not.toHaveProperty("cmsSessionId");
    expect(dto).not.toHaveProperty("onlineUrl");
    expect(dto).not.toHaveProperty("status");
    expect(dto.content?.coverImage).not.toHaveProperty("id");
  });

  it("keeps the facts and answers `content: null` when Strapi fails", async () => {
    const { service, strapi } = setup();
    strapi.findSessionDetailById.mockRejectedValue(new Error("Strapi is down"));

    const dto = await service.getPublicSession(slug, sessionId);

    expect(dto.title).toBe("Offline-first Event Apps");
    expect(dto.content).toBeNull();
  });

  it("answers empty content when the session has no Strapi entry yet", async () => {
    const { service, strapi } = setup(row({ cmsSessionId: null }));

    const dto = await service.getPublicSession(slug, sessionId);

    expect(strapi.findSessionDetailById).not.toHaveBeenCalled();
    expect(dto.content).toEqual({
      description: "",
      prerequisites: null,
      resources: [],
      coverImage: null,
    });
  });

  it("answers empty content when the entry was deleted in Strapi", async () => {
    const { service, strapi } = setup();
    strapi.findSessionDetailById.mockResolvedValue(null);

    const dto = await service.getPublicSession(slug, sessionId);

    expect(dto.content?.description).toBe("");
  });

  it("drops resources that are not https links", async () => {
    const { service, strapi } = setup();
    strapi.findSessionDetailById.mockResolvedValue(
      detail({
        resources: [
          { label: "Slides", url: "https://example.com/slides" },
          { label: "Script", url: "javascript:alert(1)" },
          { label: "Insecure", url: "http://example.com" },
          { label: "No link", url: null },
        ],
      }),
    );

    const dto = await service.getPublicSession(slug, sessionId);

    expect(dto.content?.resources).toEqual([
      { label: "Slides", url: "https://example.com/slides" },
    ]);
  });

  it("shows a cancelled event's session with the event's cancelled status", async () => {
    const { service } = setup(
      row({ event: { ...row().event, status: "cancelled" } }),
    );

    const dto = await service.getPublicSession(slug, sessionId);

    expect(dto.event.status).toBe("cancelled");
  });

  it("answers no hall and no time for an online session still without a slot", async () => {
    const { service } = setup(
      row({ mode: "online", hallName: null, startAt: null, endAt: null }),
    );

    const dto = await service.getPublicSession(slug, sessionId);

    expect(dto).toMatchObject({ hallName: null, startAt: null, endAt: null });
  });
});
