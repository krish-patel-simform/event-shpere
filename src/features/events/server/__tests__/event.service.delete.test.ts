import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
} from "../../../../core/http/errors";
import type { CmsEventPage, CmsMedia, CmsSessionDetail } from "../../../cms";
import {
  admin,
  attendee,
  emptyPage,
  eventId,
  eventRecord,
  organizer,
  otherOrganizer,
  setupEventService,
} from "../../__fixtures__/event-service";

// Empty factories: the DB client, Strapi client and env are never loaded.
jest.mock("../event.repository", () => ({}));
// The Strapi clients are never loaded; the image helpers are pure, so the real ones are kept.
jest.mock("../../../cms/server", () =>
  jest.requireActual("../../../cms/server/image-upload"),
);
jest.mock("../../../organizer/server", () => ({}));

const media = (id: number): CmsMedia => ({
  id,
  url: `http://cms.test/uploads/${id}.jpg`,
  alt: null,
  width: 800,
  height: 600,
});

/** A page with a cover (file 11) and two gallery images (files 12 and 13). */
const pageWithMedia: CmsEventPage = {
  ...emptyPage,
  coverImage: media(11),
  gallery: [media(12), media(13)],
};

const detail = (
  documentId: string,
  coverImage: CmsMedia | null,
): CmsSessionDetail => ({
  documentId,
  description: [],
  prerequisites: null,
  coverImage,
  resources: [],
});

let errorSpy: jest.SpyInstance;
beforeEach(() => {
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => errorSpy.mockRestore());

/** The organizer's draft (the fixture's default) with a page, two sessions and their covers. */
function setup() {
  const ctx = setupEventService();
  ctx.strapi.findEventPageById.mockResolvedValue(pageWithMedia);
  ctx.repo.listSessionCmsIds.mockResolvedValue(["sess-1", "sess-2"]);
  ctx.sessionStrapi.findSessionDetailById.mockImplementation(
    async (id: string) =>
      id === "sess-1" ? detail(id, media(21)) : detail(id, null),
  );
  ctx.repo.deleteDraftEvent.mockResolvedValue({
    event: eventRecord,
    sessionCmsIds: ["sess-1", "sess-2"],
  });
  return ctx;
}

describe("eventService.deleteEvent", () => {
  it("deletes the draft in Postgres by its id", async () => {
    const { service, repo } = setup();

    await expect(
      service.deleteEvent(eventId, organizer),
    ).resolves.toBeUndefined();

    expect(repo.deleteDraftEvent).toHaveBeenCalledWith(eventId);
  });

  describe("what is removed from Strapi", () => {
    it("removes the event page, every session entry and every media file", async () => {
      const { service, strapi, sessionStrapi, media: mediaClient } = setup();

      await service.deleteEvent(eventId, organizer);

      expect(strapi.deleteEventPage).toHaveBeenCalledWith("doc-1");
      expect(sessionStrapi.deleteSessionDetail).toHaveBeenCalledTimes(2);
      expect(sessionStrapi.deleteSessionDetail).toHaveBeenCalledWith("sess-1");
      expect(sessionStrapi.deleteSessionDetail).toHaveBeenCalledWith("sess-2");
      // The page's cover (11), its gallery (12, 13) and the first session's cover (21).
      const removed = mediaClient.deleteFile.mock.calls
        .map(([id]) => id as number)
        .sort((a, b) => a - b);
      expect(removed).toEqual([11, 12, 13, 21]);
    });

    it("reads the media ids BEFORE anything is deleted (they exist only in the entries)", async () => {
      const { service, repo, strapi, sessionStrapi } = setup();
      const order: string[] = [];
      strapi.findEventPageById.mockImplementation(async () => {
        order.push("read page");
        return pageWithMedia;
      });
      sessionStrapi.findSessionDetailById.mockImplementation(async (id) => {
        order.push(`read ${id}`);
        return detail(id, null);
      });
      repo.deleteDraftEvent.mockImplementation(async () => {
        order.push("delete in Postgres");
        return { event: eventRecord, sessionCmsIds: ["sess-1", "sess-2"] };
      });
      strapi.deleteEventPage.mockImplementation(async () => {
        order.push("delete page");
      });

      await service.deleteEvent(eventId, organizer);

      expect(order.indexOf("delete in Postgres")).toBeGreaterThan(
        order.indexOf("read page"),
      );
      expect(order.indexOf("delete in Postgres")).toBeGreaterThan(
        order.indexOf("read sess-2"),
      );
      expect(order.indexOf("delete page")).toBeGreaterThan(
        order.indexOf("delete in Postgres"),
      );
    });

    it("removes a file used twice only once", async () => {
      const { service, media: mediaClient, strapi } = setup();
      strapi.findEventPageById.mockResolvedValue({
        ...pageWithMedia,
        gallery: [media(11), media(12)],
      });

      await service.deleteEvent(eventId, organizer);

      const removed = mediaClient.deleteFile.mock.calls.map(([id]) => id);
      expect(removed.filter((id) => id === 11)).toHaveLength(1);
    });

    it("removes the entries of sessions the Postgres delete reports, even ones not read before", async () => {
      // A session added between the read and the delete: it has an (empty) entry, no cover yet.
      const { service, repo, sessionStrapi } = setup();
      repo.deleteDraftEvent.mockResolvedValue({
        event: eventRecord,
        sessionCmsIds: ["sess-1", "sess-2", "sess-3"],
      });

      await service.deleteEvent(eventId, organizer);

      expect(sessionStrapi.deleteSessionDetail).toHaveBeenCalledWith("sess-3");
    });

    it("skips the page when the event never got one, and sessions without an entry", async () => {
      const {
        service,
        repo,
        strapi,
        sessionStrapi,
        media: mediaClient,
      } = setup();
      repo.findEventById.mockResolvedValue({
        ...eventRecord,
        cmsEventId: null,
      });
      repo.listSessionCmsIds.mockResolvedValue([]);
      repo.deleteDraftEvent.mockResolvedValue({
        event: { ...eventRecord, cmsEventId: null },
        sessionCmsIds: [],
      });

      await service.deleteEvent(eventId, organizer);

      expect(strapi.findEventPageById).not.toHaveBeenCalled();
      expect(strapi.deleteEventPage).not.toHaveBeenCalled();
      expect(sessionStrapi.deleteSessionDetail).not.toHaveBeenCalled();
      expect(mediaClient.deleteFile).not.toHaveBeenCalled();
    });

    it("copes with a page or entry that was already removed in Strapi", async () => {
      const { service, strapi, sessionStrapi, media: mediaClient } = setup();
      strapi.findEventPageById.mockResolvedValue(null);
      sessionStrapi.findSessionDetailById.mockResolvedValue(null);

      await expect(
        service.deleteEvent(eventId, organizer),
      ).resolves.toBeUndefined();

      expect(mediaClient.deleteFile).not.toHaveBeenCalled();
      // The deletes still go out: Strapi answers 404 for a missing entry, which counts as done.
      expect(strapi.deleteEventPage).toHaveBeenCalledWith("doc-1");
    });
  });

  describe("when Strapi cannot be read first", () => {
    it("answers 503 and deletes NOTHING (the media ids would be lost)", async () => {
      const {
        service,
        repo,
        strapi,
        sessionStrapi,
        media: mediaClient,
      } = setup();
      strapi.findEventPageById.mockRejectedValue(new Error("Strapi is down"));

      await expect(
        service.deleteEvent(eventId, organizer),
      ).rejects.toBeInstanceOf(ServiceUnavailableError);

      expect(repo.deleteDraftEvent).not.toHaveBeenCalled();
      expect(strapi.deleteEventPage).not.toHaveBeenCalled();
      expect(sessionStrapi.deleteSessionDetail).not.toHaveBeenCalled();
      expect(mediaClient.deleteFile).not.toHaveBeenCalled();
    });

    it("answers 503 too when a session's entry cannot be read", async () => {
      const { service, repo, sessionStrapi } = setup();
      sessionStrapi.findSessionDetailById.mockRejectedValue(new Error("boom"));

      await expect(
        service.deleteEvent(eventId, organizer),
      ).rejects.toBeInstanceOf(ServiceUnavailableError);
      expect(repo.deleteDraftEvent).not.toHaveBeenCalled();
    });
  });

  describe("when Strapi fails AFTER the event is deleted", () => {
    it("still succeeds, tries every removal anyway, and logs what is left by id", async () => {
      const { service, strapi, sessionStrapi, media: mediaClient } = setup();
      strapi.deleteEventPage.mockRejectedValue(new Error("page down"));
      sessionStrapi.deleteSessionDetail.mockImplementation(
        async (id: string) => {
          if (id === "sess-1") throw new Error("entry down");
        },
      );
      mediaClient.deleteFile.mockImplementation(async (id: number) => {
        if (id === 12) throw new Error("file down");
      });

      await expect(
        service.deleteEvent(eventId, organizer),
      ).resolves.toBeUndefined();

      // One failure never stops the others.
      expect(sessionStrapi.deleteSessionDetail).toHaveBeenCalledTimes(2);
      expect(mediaClient.deleteFile).toHaveBeenCalledTimes(4);
      const logged = errorSpy.mock.calls.map((call) => String(call[0]));
      expect(logged).toEqual(
        expect.arrayContaining([
          expect.stringContaining("event page doc-1"),
          expect.stringContaining("session detail sess-1"),
          expect.stringContaining("media file 12"),
        ]),
      );
    });
  });

  describe("only a draft", () => {
    it.each(["published", "cancelled"] as const)(
      "refuses a %s event with 409 EVENT_NOT_DRAFT and touches nothing",
      async (status) => {
        const { service, repo, strapi, media: mediaClient } = setup();
        repo.findEventById.mockResolvedValue({ ...eventRecord, status });

        await expect(
          service.deleteEvent(eventId, organizer),
        ).rejects.toMatchObject({
          constructor: ConflictError,
          code: "EVENT_NOT_DRAFT",
        });

        expect(repo.deleteDraftEvent).not.toHaveBeenCalled();
        expect(strapi.findEventPageById).not.toHaveBeenCalled();
        expect(strapi.deleteEventPage).not.toHaveBeenCalled();
        expect(mediaClient.deleteFile).not.toHaveBeenCalled();
      },
    );

    it("answers 409 EVENT_NOT_DRAFT, and removes nothing from Strapi, when it was published a moment ago", async () => {
      const { service, repo, strapi, media: mediaClient } = setup();
      // The check saw a draft, but the locked DELETE found it published.
      repo.deleteDraftEvent.mockResolvedValue(null);
      repo.findEventRecord.mockResolvedValue({
        ...eventRecord,
        status: "published",
      });

      await expect(
        service.deleteEvent(eventId, organizer),
      ).rejects.toMatchObject({
        code: "EVENT_NOT_DRAFT",
      });

      expect(strapi.deleteEventPage).not.toHaveBeenCalled();
      expect(mediaClient.deleteFile).not.toHaveBeenCalled();
    });

    it("answers 404 when another request deleted it first, and removes nothing", async () => {
      const { service, repo, strapi } = setup();
      repo.deleteDraftEvent.mockResolvedValue(null);
      repo.findEventRecord.mockResolvedValue(null);

      await expect(
        service.deleteEvent(eventId, organizer),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(strapi.deleteEventPage).not.toHaveBeenCalled();
    });

    it("answers 409 EVENT_HAS_REGISTRATIONS when the database still has registrations for it", async () => {
      const { service, repo, strapi, media: mediaClient } = setup();
      repo.deleteDraftEvent.mockResolvedValue("in_use");

      await expect(
        service.deleteEvent(eventId, organizer),
      ).rejects.toMatchObject({
        code: "EVENT_HAS_REGISTRATIONS",
      });

      // Nothing was deleted in Postgres, so nothing may be removed from Strapi either.
      expect(strapi.deleteEventPage).not.toHaveBeenCalled();
      expect(mediaClient.deleteFile).not.toHaveBeenCalled();
    });
  });

  describe("who may delete", () => {
    it("refuses an admin (403) before touching anything: only an organizer deletes", async () => {
      const { service, repo } = setup();

      await expect(service.deleteEvent(eventId, admin)).rejects.toBeInstanceOf(
        ForbiddenError,
      );
      expect(repo.findEventById).not.toHaveBeenCalled();
      expect(repo.deleteDraftEvent).not.toHaveBeenCalled();
    });

    it("refuses someone with no event permission (403)", async () => {
      const { service, repo } = setup();

      await expect(
        service.deleteEvent(eventId, attendee),
      ).rejects.toBeInstanceOf(ForbiddenError);
      expect(repo.deleteDraftEvent).not.toHaveBeenCalled();
    });

    it("answers 404 for another organizer's event, never saying it exists", async () => {
      const { service, repo, strapi } = setup();

      await expect(
        service.deleteEvent(eventId, otherOrganizer),
      ).rejects.toBeInstanceOf(NotFoundError);

      expect(repo.deleteDraftEvent).not.toHaveBeenCalled();
      expect(strapi.findEventPageById).not.toHaveBeenCalled();
    });

    it("answers 404 for an event that does not exist", async () => {
      const { service, repo } = setup();
      repo.findEventById.mockResolvedValue(null);

      await expect(
        service.deleteEvent(eventId, organizer),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(repo.deleteDraftEvent).not.toHaveBeenCalled();
    });
  });
});
