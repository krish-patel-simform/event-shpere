import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
  ValidationError,
} from "../../../../core/http/errors";
import type { CmsEventPage, CmsMedia } from "../../../cms";
import {
  admin,
  attendee,
  eventId,
  eventRef as event,
  organizer,
  otherOrganizer,
  setupEventService,
} from "../../__fixtures__/event-service";
import {
  EVENT_GALLERY_MAX_IMAGES,
  EVENT_IMAGE_MAX_BODY_BYTES,
} from "../../constants";
import {
  eventContentResponseSchema,
  updateEventContentBodySchema,
} from "../../schemas/event-content.schemas";

// Empty factories: the DB client, Strapi clients and env are never loaded.
jest.mock("../event.repository", () => ({}));
jest.mock("../../../cms/server", () => ({}));
jest.mock("../../../organizer/server", () => ({}));

const paragraph = (text: string) => ({
  type: "paragraph",
  children: [{ type: "text", text }],
});

const media = (id: number): CmsMedia => ({
  id,
  url: `http://cms.test/uploads/${id}.jpg`,
  alt: null,
  width: 800,
  height: 600,
});

const page = (overrides: Partial<CmsEventPage> = {}): CmsEventPage => ({
  documentId: "doc-1",
  tagline: null,
  about: [],
  venueGuide: [],
  coverImage: null,
  gallery: [],
  highlights: [],
  faqs: [],
  seo: { metaTitle: null, metaDescription: null },
  ...overrides,
});

// What Strapi reports about a freshly uploaded file.
const newFile = {
  id: 31,
  mime: "image/jpeg",
  size: 300,
  width: 800,
  height: 600,
};

const upload = (bytes = 100) => ({
  body: new Blob([new Uint8Array(bytes)]).stream(),
  contentType: "multipart/form-data; boundary=abc",
});

/** The shared service with uploads succeeding by default: one good image, file 31. */
function setup() {
  const ctx = setupEventService();
  ctx.media.uploadFiles.mockResolvedValue({ ok: true, files: [newFile] });
  return { ...ctx, mediaClient: ctx.media };
}

let errorSpy: jest.SpyInstance;
beforeEach(() => {
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => errorSpy.mockRestore());

describe("who may use an event's page", () => {
  it("refuses a user with no event permission (403) before looking anything up", async () => {
    const { service, repo } = setup();

    await expect(service.getContent(eventId, attendee)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(repo.findEventById).not.toHaveBeenCalled();
  });

  it("answers 404, not 403, for somebody else's event", async () => {
    const { service, strapi } = setup();

    await expect(
      service.updateContent(eventId, { tagline: "x" }, otherOrganizer),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(strapi.updateEventPage).not.toHaveBeenCalled();
  });

  it("answers 404 for an event that does not exist", async () => {
    const { service, repo } = setup();
    repo.findEventById.mockResolvedValue(null);

    await expect(service.getContent(eventId, organizer)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("lets an admin (EVENT_MANAGE_ALL) edit any event", async () => {
    const { service, strapi } = setup();

    await service.updateContent(eventId, { tagline: "x" }, admin);

    expect(strapi.updateEventPage).toHaveBeenCalled();
  });

  it("stops an organizer an admin has not approved, before touching Strapi", async () => {
    const { service, strapi, verification } = setup();
    verification.assertVerifiedOrganizer.mockRejectedValue(
      new ForbiddenError(
        "waiting for admin approval",
        "ORGANIZER_NOT_VERIFIED",
      ),
    );

    await expect(
      service.updateContent(eventId, { tagline: "x" }, organizer),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(verification.assertVerifiedOrganizer).toHaveBeenCalledWith(
      organizer,
    );
    expect(strapi.updateEventPage).not.toHaveBeenCalled();
  });

  it("refuses every write to a cancelled event (409) but still lets it be read", async () => {
    const { service, repo, strapi, mediaClient } = setup();
    repo.findEventById.mockResolvedValue({ ...event, status: "cancelled" });

    const writes = [
      service.updateContent(eventId, { tagline: "x" }, organizer),
      service.replaceCover(eventId, upload(), organizer),
      service.removeCover(eventId, organizer),
      service.addGalleryImage(eventId, upload(), organizer),
      service.removeGalleryImage(eventId, 5, organizer),
    ];
    for (const write of writes) {
      const error = await write.catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ConflictError);
      expect((error as ConflictError).code).toBe("EVENT_CANCELLED");
    }
    expect(strapi.updateEventPage).not.toHaveBeenCalled();
    expect(mediaClient.uploadFiles).not.toHaveBeenCalled();

    await expect(service.getContent(eventId, organizer)).resolves.toBeDefined();
  });
});

describe("eventService.getContent", () => {
  it("returns the page as the edit form needs it: plain text, images, empty things", async () => {
    const { service, strapi } = setup();
    strapi.findEventPageById.mockResolvedValue(
      page({
        tagline: "Learn it all",
        about: [paragraph("One"), paragraph("Two")],
        venueGuide: [paragraph("Take the metro")],
        coverImage: media(9),
        gallery: [media(5), media(6)],
        highlights: [{ title: "Keynote", description: null }],
        faqs: [{ question: "Parking?", answer: [paragraph("Yes")] }],
        seo: { metaTitle: "Tech Conf", metaDescription: null },
      }),
    );

    const content = await service.getContent(eventId, organizer);

    expect(strapi.findEventPageById).toHaveBeenCalledWith("doc-1");
    expect(content).toEqual({
      tagline: "Learn it all",
      about: "One\n\nTwo",
      venueGuide: "Take the metro",
      highlights: [{ title: "Keynote", description: "" }],
      faqs: [{ question: "Parking?", answer: "Yes" }],
      seo: { metaTitle: "Tech Conf", metaDescription: null },
      coverImage: {
        id: 9,
        url: "http://cms.test/uploads/9.jpg",
        alt: null,
        width: 800,
        height: 600,
      },
      gallery: [
        expect.objectContaining({ id: 5 }),
        expect.objectContaining({ id: 6 }),
      ],
    });
    expect(() => eventContentResponseSchema.parse(content)).not.toThrow();
  });

  it("returns an empty form for an event with no Strapi page yet", async () => {
    const { service, repo, strapi } = setup();
    repo.findEventById.mockResolvedValue({ ...event, cmsEventId: null });

    const content = await service.getContent(eventId, organizer);

    expect(strapi.findEventPageById).not.toHaveBeenCalled();
    expect(content).toMatchObject({
      tagline: null,
      about: "",
      highlights: [],
      faqs: [],
      coverImage: null,
      gallery: [],
    });
  });

  it("503 when Strapi fails, never an empty form that could wipe the real content", async () => {
    const { service, strapi } = setup();
    strapi.findEventPageById.mockRejectedValue(
      new Error("connect ECONNREFUSED"),
    );

    const error = await service
      .getContent(eventId, organizer)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ServiceUnavailableError);
    expect((error as ServiceUnavailableError).code).toBe("CMS_UNAVAILABLE");
  });
});

describe("eventService.updateContent", () => {
  it("sends only the fields that were sent, with rich text turned into blocks", async () => {
    const { service, strapi } = setup();

    await service.updateContent(
      eventId,
      updateEventContentBodySchema.parse({
        tagline: "Learn it all",
        about: "One\n\nTwo",
        faqs: [{ question: "Parking?", answer: "Yes" }],
      }),
      organizer,
    );

    // toEqual: no other key (e.g. venueGuide: undefined) goes to Strapi.
    expect(strapi.updateEventPage).toHaveBeenCalledWith("doc-1", {
      tagline: "Learn it all",
      about: [paragraph("One"), paragraph("Two")],
      faqs: [{ question: "Parking?", answer: [paragraph("Yes")] }],
    });
  });

  it("clears a field with null or an empty text, and an empty highlight description is null", async () => {
    const { service, strapi } = setup();

    await service.updateContent(
      eventId,
      updateEventContentBodySchema.parse({
        tagline: "",
        about: null,
        venueGuide: "   ",
        seo: null,
        highlights: [{ title: "Keynote" }],
      }),
      organizer,
    );

    expect(strapi.updateEventPage).toHaveBeenCalledWith("doc-1", {
      tagline: null,
      about: null,
      venueGuide: null,
      seo: null,
      highlights: [{ title: "Keynote", description: null }],
    });
  });

  it("replaces the seo component as a whole, missing parts becoming null", async () => {
    const { service, strapi } = setup();

    await service.updateContent(
      eventId,
      updateEventContentBodySchema.parse({ seo: { metaTitle: "Tech Conf" } }),
      organizer,
    );

    expect(strapi.updateEventPage).toHaveBeenCalledWith("doc-1", {
      seo: { metaTitle: "Tech Conf", metaDescription: null },
    });
  });

  it("returns the saved page in the edit-form shape", async () => {
    const { service, strapi } = setup();
    strapi.updateEventPage.mockResolvedValue(page({ tagline: "Saved" }));

    const content = await service.updateContent(
      eventId,
      { tagline: "Saved" },
      organizer,
    );

    expect(content.tagline).toBe("Saved");
  });

  it("creates and links a new page when the event has none", async () => {
    const { service, repo, strapi } = setup();
    repo.findEventById.mockResolvedValue({ ...event, cmsEventId: null });

    await service.updateContent(eventId, { tagline: "x" }, organizer);

    expect(strapi.createEventPage).toHaveBeenCalledWith({ eventId });
    expect(repo.setCmsEventId).toHaveBeenCalledWith(eventId, "doc-new");
    expect(strapi.updateEventPage).toHaveBeenCalledWith("doc-new", {
      tagline: "x",
    });
  });

  it("repairs the link when the page was deleted in Strapi", async () => {
    const { service, repo, strapi } = setup();
    strapi.updateEventPage
      .mockResolvedValueOnce(null) // "doc-1" is gone
      .mockResolvedValueOnce(page({ documentId: "doc-new", tagline: "x" }));

    await service.updateContent(eventId, { tagline: "x" }, organizer);

    expect(strapi.createEventPage).toHaveBeenCalledWith({ eventId });
    expect(repo.setCmsEventId).toHaveBeenCalledWith(eventId, "doc-new");
    expect(strapi.updateEventPage).toHaveBeenLastCalledWith("doc-new", {
      tagline: "x",
    });
  });

  it("503 when Strapi cannot save", async () => {
    const { service, strapi } = setup();
    strapi.updateEventPage.mockRejectedValue(new Error("timeout"));

    await expect(
      service.updateContent(eventId, { tagline: "x" }, organizer),
    ).rejects.toBeInstanceOf(ServiceUnavailableError);
  });
});

describe("eventService.replaceCover", () => {
  // The event's current cover is file 9.
  function coverSetup() {
    const ctx = setup();
    ctx.strapi.findEventPageById.mockResolvedValue(
      page({ coverImage: media(9) }),
    );
    ctx.strapi.updateEventPage.mockResolvedValue(
      page({ coverImage: media(31) }),
    );
    return ctx;
  }

  it("streams the upload to Strapi, sets it as the cover, then deletes the old one", async () => {
    const { service, strapi, mediaClient } = coverSetup();
    const coverUpload = upload();

    const result = await service.replaceCover(eventId, coverUpload, organizer);

    expect(mediaClient.uploadFiles).toHaveBeenCalledWith(
      expect.any(ReadableStream),
      "multipart/form-data; boundary=abc",
    );
    expect(strapi.updateEventPage).toHaveBeenCalledWith("doc-1", {
      coverImage: 31,
    });
    expect(mediaClient.deleteFile).toHaveBeenCalledWith(9);
    expect(mediaClient.deleteFile).not.toHaveBeenCalledWith(31);
    expect(result.coverImage).toMatchObject({ id: 31 });
  });

  it("deletes nothing old when the event had no cover", async () => {
    const { service, strapi, mediaClient } = coverSetup();
    strapi.findEventPageById.mockResolvedValue(page());

    await service.replaceCover(eventId, upload(), organizer);

    expect(mediaClient.deleteFile).not.toHaveBeenCalled();
  });

  it("checks who may edit before a single byte goes to Strapi", async () => {
    const { service, mediaClient } = coverSetup();

    await expect(
      service.replaceCover(eventId, upload(), otherOrganizer),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(mediaClient.uploadFiles).not.toHaveBeenCalled();
  });

  it("deletes the upload and returns 400 when it is not an image (e.g. a PDF)", async () => {
    const { service, strapi, mediaClient } = coverSetup();
    mediaClient.uploadFiles.mockResolvedValue({
      ok: true,
      files: [
        { ...newFile, mime: "application/pdf", width: null, height: null },
      ],
    });

    await expect(
      service.replaceCover(eventId, upload(), organizer),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(mediaClient.deleteFile).toHaveBeenCalledWith(31);
    expect(strapi.updateEventPage).not.toHaveBeenCalled();
  });

  it("deletes every file and returns 400 when more than one was sent", async () => {
    const { service, mediaClient } = coverSetup();
    mediaClient.uploadFiles.mockResolvedValue({
      ok: true,
      files: [newFile, { ...newFile, id: 32 }],
    });

    await expect(
      service.replaceCover(eventId, upload(), organizer),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(mediaClient.deleteFile).toHaveBeenCalledWith(31);
    expect(mediaClient.deleteFile).toHaveBeenCalledWith(32);
  });

  it("returns 400 when Strapi itself refuses the file", async () => {
    const { service, strapi, mediaClient } = coverSetup();
    mediaClient.uploadFiles.mockResolvedValue({ ok: false, status: 415 });

    await expect(
      service.replaceCover(eventId, upload(), organizer),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(strapi.updateEventPage).not.toHaveBeenCalled();
  });

  it("cuts off a body over the size limit while streaming → 400", async () => {
    const { service, strapi, mediaClient } = coverSetup();
    // Like real fetch: reads the (size-limited) stream, which errors past the limit.
    mediaClient.uploadFiles.mockImplementation(
      async (body: ReadableStream<Uint8Array>) => {
        const reader = body.getReader();
        for (;;) {
          const { done } = await reader.read();
          if (done) return { ok: true as const, files: [newFile] };
        }
      },
    );

    const error = await service
      .replaceCover(eventId, upload(EVENT_IMAGE_MAX_BODY_BYTES + 1), organizer)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect(strapi.updateEventPage).not.toHaveBeenCalled();
  });

  it("returns 503 when the upload to Strapi fails", async () => {
    const { service, mediaClient } = coverSetup();
    mediaClient.uploadFiles.mockRejectedValue(new Error("connection reset"));

    await expect(
      service.replaceCover(eventId, upload(), organizer),
    ).rejects.toMatchObject({ status: 503 });
  });

  it("deletes the new file and keeps the old cover when setting it fails", async () => {
    const { service, strapi, mediaClient } = coverSetup();
    strapi.updateEventPage.mockRejectedValue(new Error("timeout"));

    await expect(
      service.replaceCover(eventId, upload(), organizer),
    ).rejects.toMatchObject({ status: 503 });
    expect(mediaClient.deleteFile).toHaveBeenCalledWith(31);
    expect(mediaClient.deleteFile).not.toHaveBeenCalledWith(9);
  });
});

describe("eventService.removeCover", () => {
  it("clears the cover in Strapi, then deletes its file", async () => {
    const { service, strapi, mediaClient } = setup();
    strapi.findEventPageById.mockResolvedValue(page({ coverImage: media(9) }));

    const result = await service.removeCover(eventId, organizer);

    expect(strapi.updateEventPage).toHaveBeenCalledWith("doc-1", {
      coverImage: null,
    });
    expect(mediaClient.deleteFile).toHaveBeenCalledWith(9);
    expect(result).toEqual({ coverImage: null });
  });

  it("does nothing when there is no cover", async () => {
    const { service, strapi, mediaClient } = setup();

    await expect(service.removeCover(eventId, organizer)).resolves.toEqual({
      coverImage: null,
    });
    expect(strapi.updateEventPage).not.toHaveBeenCalled();
    expect(mediaClient.deleteFile).not.toHaveBeenCalled();
  });
});

describe("eventService.addGalleryImage", () => {
  it("appends the new image to the existing ones and returns the whole gallery", async () => {
    const { service, strapi } = setup();
    strapi.findEventPageById.mockResolvedValue(
      page({ gallery: [media(5), media(6)] }),
    );
    strapi.updateEventPage.mockResolvedValue(
      page({ gallery: [media(5), media(6), media(31)] }),
    );

    const result = await service.addGalleryImage(eventId, upload(), organizer);

    expect(strapi.updateEventPage).toHaveBeenCalledWith("doc-1", {
      gallery: [5, 6, 31],
    });
    expect(result.gallery.map((item) => item.id)).toEqual([5, 6, 31]);
  });

  it("refuses a full gallery (409) before the upload costs anything", async () => {
    const { service, strapi, mediaClient } = setup();
    strapi.findEventPageById.mockResolvedValue(
      page({
        gallery: Array.from({ length: EVENT_GALLERY_MAX_IMAGES }, (_, i) =>
          media(i + 1),
        ),
      }),
    );

    const error = await service
      .addGalleryImage(eventId, upload(), organizer)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictError);
    expect((error as ConflictError).code).toBe("GALLERY_FULL");
    expect(mediaClient.uploadFiles).not.toHaveBeenCalled();
  });

  it("deletes the new file when saving the gallery fails", async () => {
    const { service, strapi, mediaClient } = setup();
    strapi.updateEventPage.mockRejectedValue(new Error("timeout"));

    await expect(
      service.addGalleryImage(eventId, upload(), organizer),
    ).rejects.toMatchObject({ status: 503 });
    expect(mediaClient.deleteFile).toHaveBeenCalledWith(31);
  });

  it("returns 400 and keeps the gallery when the file is not an image", async () => {
    const { service, strapi, mediaClient } = setup();
    mediaClient.uploadFiles.mockResolvedValue({
      ok: true,
      files: [{ ...newFile, mime: "image/gif" }],
    });

    await expect(
      service.addGalleryImage(eventId, upload(), organizer),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(strapi.updateEventPage).not.toHaveBeenCalled();
    expect(mediaClient.deleteFile).toHaveBeenCalledWith(31);
  });
});

describe("eventService.removeGalleryImage", () => {
  it("removes the image from the gallery, then deletes its file", async () => {
    const { service, strapi, mediaClient } = setup();
    strapi.findEventPageById.mockResolvedValue(
      page({ gallery: [media(5), media(6), media(7)] }),
    );
    strapi.updateEventPage.mockResolvedValue(
      page({ gallery: [media(5), media(7)] }),
    );

    const result = await service.removeGalleryImage(eventId, 6, organizer);

    expect(strapi.updateEventPage).toHaveBeenCalledWith("doc-1", {
      gallery: [5, 7],
    });
    expect(mediaClient.deleteFile).toHaveBeenCalledWith(6);
    expect(result.gallery.map((item) => item.id)).toEqual([5, 7]);
  });

  it("404 for an image that is not in THIS event's gallery, deleting nothing", async () => {
    const { service, strapi, mediaClient } = setup();
    strapi.findEventPageById.mockResolvedValue(page({ gallery: [media(5)] }));

    // 99 may be a real file of another event: it must never be touched from here.
    await expect(
      service.removeGalleryImage(eventId, 99, organizer),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(strapi.updateEventPage).not.toHaveBeenCalled();
    expect(mediaClient.deleteFile).not.toHaveBeenCalled();
  });
});
