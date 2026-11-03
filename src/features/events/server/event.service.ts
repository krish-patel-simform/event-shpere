import "server-only";
import { randomUUID } from "node:crypto";
import { createByteLimit } from "../../../core/http/byte-limit";
// Direct file import: the core/http barrel also pulls in the route wrapper and cookies.
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
  ValidationError,
} from "../../../core/http/errors";
import type { PageMeta } from "../../../core/http/response";
import {
  blocksToText,
  textToBlocks,
  type CmsEventPage,
  type StrapiEventPageUpdate,
  type StrapiUploadedFile,
} from "../../cms";
import {
  strapiEventClient,
  strapiMediaClient,
  type StrapiEventClient,
  type StrapiMediaClient,
} from "../../cms/server";
import {
  organizerService,
  type OrganizerService,
} from "../../organizer/server";
import {
  EVENT_GALLERY_MAX_IMAGES,
  EVENT_IMAGE_MAX_BODY_BYTES,
} from "../constants";
import type {
  EventContentDto,
  EventCoverDto,
  EventGalleryDto,
  UpdateEventContentBody,
} from "../schemas/event-content.schemas";
import type {
  EventOverviewData,
  EventTabCounts,
  ManagedEvent,
  MyEventListQuery,
} from "../schemas/event-manage.schemas";
import type {
  CreateEventBody,
  EventDto,
  UpdateEventBody,
} from "../schemas/events.schemas";
import {
  toEventContentDto,
  toEventDto,
  toEventMediaDto,
  toEventOverviewDto,
  toManagedEventDto,
} from "./event.dto";
import {
  eventRepository,
  type EventPatch,
  type EventRef,
  type EventRepository,
} from "./event.repository";
import { createEventAccess, type EventActor } from "./event-access";
import { isAcceptableEventImage, type ImageUpload } from "./event-image";

// Same default as the events.timezone column; used for a draft with no venue and no zone.
const DEFAULT_TIMEZONE = "Asia/Kolkata";

export type EventServiceDeps = {
  eventRepository: Pick<
    EventRepository,
    | "findVenue"
    | "createEvent"
    | "findEventById"
    | "setCmsEventId"
    | "listOwnEvents"
    | "countOwnEventsByTab"
    | "findManagedEvent"
    | "getOverviewExtras"
    | "findEventRecord"
    | "countRegistered"
    | "countSessionsOutside"
    | "countSessionsInOtherVenue"
    | "updateEvent"
  >;
  /** The event's page in Strapi: its text content. */
  strapiClient: Pick<
    StrapiEventClient,
    | "createEventPage"
    | "deleteEventPage"
    | "findEventPageById"
    | "updateEventPage"
  >;
  /** Strapi's media library: the image uploads and removing replaced files. */
  mediaClient: Pick<StrapiMediaClient, "uploadFiles" | "deleteFile">;
  /** An organizer may manage events only while an admin's approval stands. */
  organizerVerification: Pick<OrganizerService, "assertVerifiedOrganizer">;
  /** The current time; injected in tests. */
  now?: () => Date;
};

const cmsUnavailable = () =>
  new ServiceUnavailableError(
    "CMS_UNAVAILABLE",
    "The event content is not available right now. Please try again.",
  );

const invalidImage = () =>
  new ValidationError(
    "The image must be one JPEG, PNG or WebP file of at most 4 MB",
  );

/** Body → what Strapi gets: only the keys that were sent, rich texts turned into blocks. */
function toStrapiUpdate(body: UpdateEventContentBody): StrapiEventPageUpdate {
  const data: StrapiEventPageUpdate = {};
  // "" and null both clear a text.
  if (body.tagline !== undefined) data.tagline = body.tagline || null;
  if (body.about !== undefined) {
    data.about = body.about ? textToBlocks(body.about) : null;
  }
  if (body.venueGuide !== undefined) {
    data.venueGuide = body.venueGuide ? textToBlocks(body.venueGuide) : null;
  }
  if (body.highlights !== undefined) {
    data.highlights = body.highlights.map((item) => ({
      title: item.title,
      description: item.description || null,
    }));
  }
  if (body.faqs !== undefined) {
    data.faqs = body.faqs.map((item) => ({
      question: item.question,
      answer: textToBlocks(item.answer),
    }));
  }
  if (body.seo !== undefined) {
    data.seo =
      body.seo === null
        ? null
        : {
            metaTitle: body.seo.metaTitle || null,
            metaDescription: body.seo.metaDescription || null,
          };
  }
  return data;
}

/**
 * Everything the organizer does with events, in Postgres (the event itself: dates, venue,
 * capacity, price, who owns it) and Strapi (its page: description, FAQs, images):
 * create, list, overview, edit, and the page's content and images.
 *
 * Who may touch which event is event-access: the permission (EVENT_MANAGE_OWN for your own
 * events, EVENT_MANAGE_ALL for any), an approved organizer, and a 404 for someone else's event.
 * What each action may change is decided here, because it depends on the event's registrations,
 * sessions, dates and status.
 */
export function createEventService(deps: EventServiceDeps) {
  const repo = deps.eventRepository;
  const now = deps.now ?? (() => new Date());
  const access = createEventAccess(deps);

  //* Strapi helpers

  /** A Strapi call the request cannot do without: any failure → 503, and the caller stops. */
  async function requireCms<T>(
    what: string,
    call: () => Promise<T>,
  ): Promise<T> {
    try {
      return await call();
    } catch (error) {
      console.error(
        `[events] Strapi ${what} failed:`,
        error instanceof Error ? error.message : error,
      );
      throw cmsUnavailable();
    }
  }

  /** The empty Event Page in Strapi for a new event. Any failure → 503, nothing saved. */
  async function createCmsEventPage(eventId: string) {
    try {
      return await deps.strapiClient.createEventPage({ eventId });
    } catch (error) {
      console.error(
        "[events] Strapi event page not created:",
        error instanceof Error ? error.message : error,
      );
      throw new ServiceUnavailableError(
        "CMS_UNAVAILABLE",
        "Could not create the event right now. Please try again.",
      );
    }
  }

  /**
   * Undo for createCmsEventPage when the DB insert did not happen. Best effort: if it fails
   * too, an unused page stays in Strapi. No events row points to it, so EventSphere never
   * shows it; log its id so it can be removed by hand.
   */
  async function removeCmsEventPage(documentId: string) {
    try {
      await deps.strapiClient.deleteEventPage(documentId);
    } catch (error) {
      console.error(
        `[events] orphan Strapi event page ${documentId} not deleted:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  /**
   * The event's current Strapi page. A Strapi failure is a 503, never an empty page: an empty
   * form saved back would wipe the real content.
   */
  async function loadPage(event: EventRef): Promise<CmsEventPage | null> {
    const { cmsEventId } = event;
    if (!cmsEventId) return null;
    return requireCms("load", () =>
      deps.strapiClient.findEventPageById(cmsEventId),
    );
  }

  /**
   * Writes `data` to the event's Strapi page and returns the result. Repairs a missing link
   * on the way: no page linked yet, or the page was deleted in Strapi → a new one is created
   * and linked first.
   */
  async function saveToCms(
    event: EventRef,
    data: StrapiEventPageUpdate,
  ): Promise<CmsEventPage> {
    const { cmsEventId } = event;
    if (cmsEventId) {
      const updated = await requireCms("update", () =>
        deps.strapiClient.updateEventPage(cmsEventId, data),
      );
      if (updated) return updated;
      console.error(
        `[events] Strapi event page ${cmsEventId} is missing; creating a new one`,
      );
    }

    const created = await requireCms("create", () =>
      deps.strapiClient.createEventPage({ eventId: event.id }),
    );
    await repo.setCmsEventId(event.id, created.documentId);
    const updated = await requireCms("update", () =>
      deps.strapiClient.updateEventPage(created.documentId, data),
    );
    if (!updated) throw cmsUnavailable();
    return updated;
  }

  /**
   * What the event page holds, for the publish checklist. The overview must still load when the
   * CMS is down, so a failure is null ("could not check"), not an error.
   */
  async function loadContentFlags(
    cmsEventId: string | null,
  ): Promise<EventOverviewData["content"]> {
    if (!cmsEventId) return { hasDescription: false, hasBanner: false };
    try {
      const page = await deps.strapiClient.findEventPageById(cmsEventId);
      return {
        hasDescription: page ? blocksToText(page.about).trim() !== "" : false,
        hasBanner: page ? page.coverImage !== null : false,
      };
    } catch (error) {
      console.error(
        "[events] Strapi event page not read for the overview:",
        error instanceof Error ? error.message : error,
      );
      return null;
    }
  }

  //* Image helpers

  /** Best effort: a file left behind only takes space in the media library. */
  async function removeUploadedFile(id: number) {
    try {
      await deps.mediaClient.deleteFile(id);
    } catch (error) {
      console.error(
        `[events] Strapi file ${id} not deleted:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  /**
   * Streams the upload to Strapi (counting the bytes on the way) and checks what Strapi
   * stored: exactly one real image of an allowed type and size. Anything else is deleted again.
   */
  async function uploadOneImage(
    upload: ImageUpload,
  ): Promise<StrapiUploadedFile> {
    const limit = createByteLimit(EVENT_IMAGE_MAX_BODY_BYTES);
    let result: Awaited<ReturnType<StrapiMediaClient["uploadFiles"]>>;
    try {
      result = await deps.mediaClient.uploadFiles(
        upload.body.pipeThrough(limit.stream),
        upload.contentType,
      );
    } catch (error) {
      if (limit.exceeded()) throw invalidImage();
      console.error(
        "[events] image upload to Strapi failed:",
        error instanceof Error ? error.message : error,
      );
      throw cmsUnavailable();
    }
    // Strapi refused the file itself (e.g. a type its upload settings deny).
    if (!result.ok) throw invalidImage();

    const [image, ...extra] = result.files;
    if (!image || extra.length > 0 || !isAcceptableEventImage(image)) {
      await Promise.all(
        result.files.map((file) => removeUploadedFile(file.id)),
      );
      throw invalidImage();
    }
    return image;
  }

  /** saveToCms for an image that was just uploaded: if saving fails, the new file is removed. */
  async function saveImageToCms(
    event: EventRef,
    image: StrapiUploadedFile,
    data: StrapiEventPageUpdate,
  ): Promise<CmsEventPage> {
    try {
      return await saveToCms(event, data);
    } catch (error) {
      await removeUploadedFile(image.id);
      throw error;
    }
  }

  return {
    //* The event itself

    /**
     * A verified organizer creates an event. It is always a draft. The permission
     * (EVENT_CREATE) is checked by the route wrapper; the owner is the caller's organizer
     * profile, found from the access token, never from the body. An admin has no organizer
     * profile, so an admin cannot create an event (the service refuses even if the permission
     * were ever granted).
     *
     * Order: validate → empty Event Page in Strapi → events row (same id, linked to the page).
     * Strapi goes first so the row never exists without its link; if the insert then fails,
     * the page is removed again.
     */
    async createEvent(
      body: CreateEventBody,
      currentUser: Pick<EventActor, "id" | "role">,
    ): Promise<EventDto> {
      // A self-signed-up organizer already holds EVENT_CREATE, so the permission alone does
      // not prove an admin has verified them. The answer is their organizer profile's id.
      const organizerId =
        await deps.organizerVerification.assertVerifiedOrganizer(currentUser);
      // No profile (an admin): there is no organizer to own the event, so deny.
      if (!organizerId) {
        throw new ForbiddenError("Only an organizer can create events");
      }

      const venue = body.venueId ? await repo.findVenue(body.venueId) : null;
      if (body.venueId) {
        if (!venue) throw new NotFoundError("Venue not found");
        if (!venue.isActive) {
          throw new ConflictError(
            "VENUE_INACTIVE",
            "This venue is inactive. Choose an active venue",
          );
        }
      }

      // The event happens where the venue is: its zone wins over whatever the form sent.
      const timezone = venue?.timezone ?? body.timezone ?? DEFAULT_TIMEZONE;

      // One id for both systems: Postgres events.id and the Strapi page's `eventId`.
      const eventId = randomUUID();
      const page = await createCmsEventPage(eventId);

      try {
        const event = await repo.createEvent({
          id: eventId,
          organizerId,
          cmsEventId: page.documentId,
          title: body.title,
          startAt: body.startAt,
          endAt: body.endAt,
          timezone,
          venueId: venue?.id ?? null,
          capacity: body.capacity ?? null,
          ticketPrice: body.ticketPrice,
          currency: body.currency,
          registrationOpensAt: body.registrationOpensAt ?? null,
          registrationClosesAt: body.registrationClosesAt ?? null,
        });
        return toEventDto(event);
      } catch (error) {
        await removeCmsEventPage(page.documentId);
        throw error;
      }
    },

    /**
     * One page of the caller's OWN events (those of their organizer profile), by tab, search
     * and sort. An admin has no organizer profile and owns no events, so their page is empty:
     * every event of the platform is a separate admin page.
     */
    async listOwnEvents(
      query: MyEventListQuery,
      actor: EventActor,
    ): Promise<{ items: ManagedEvent[]; meta: PageMeta }> {
      const organizerId = await access.requireManager(actor);

      const { page, pageSize, status, search, sort } = query;
      if (!organizerId) {
        return { items: [], meta: { page, pageSize, total: 0 } };
      }

      const at = now();
      const { rows, total } = await repo.listOwnEvents({
        organizerId,
        tab: status,
        // An empty search (after trim) counts as no search.
        search: search || undefined,
        sort,
        now: at,
        // page/pageSize (what the caller asks) → limit/offset (what SQL needs).
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });

      return {
        items: rows.map((row) => toManagedEventDto(row, at)),
        meta: { page, pageSize, total },
      };
    },

    /** How many of the caller's events each tab holds (all zero for an admin, who owns none). */
    async countOwnEvents(actor: EventActor): Promise<EventTabCounts> {
      const organizerId = await access.requireManager(actor);
      if (!organizerId) {
        return { all: 0, draft: 0, published: 0, completed: 0, cancelled: 0 };
      }
      return repo.countOwnEventsByTab(organizerId, now());
    },

    /** One event with the figures its overview shows. Someone else's event is a 404. */
    async getEventOverview(
      eventId: string,
      actor: EventActor,
    ): Promise<EventOverviewData> {
      const ref = await access.requireEvent(eventId, actor, { write: false });
      const row = await repo.findManagedEvent(eventId);
      if (!row) throw new NotFoundError("Event not found");

      const [extras, content] = await Promise.all([
        repo.getOverviewExtras(eventId, row.venueId),
        loadContentFlags(ref.cmsEventId),
      ]);
      return toEventOverviewDto(row, extras, content, now());
    },

    /**
     * Changes the fields that were sent. Allowed for a draft or a published event that has not
     * ended; then:
     * - the end must be after the start, and a start that moves must be in the future
     * - capacity cannot drop below the people already registered
     * - the ticket price and the venue are locked once someone has registered
     * - a venue must be active; its time zone becomes the event's
     * - sessions must stay inside the dates and in halls of the venue
     * The slug never changes. The UPDATE itself refuses an event cancelled a moment ago.
     */
    async updateEvent(
      eventId: string,
      body: UpdateEventBody,
      actor: EventActor,
    ): Promise<EventDto> {
      await access.requireEvent(eventId, actor, { write: true });
      const current = await repo.findEventRecord(eventId);
      if (!current) throw new NotFoundError("Event not found");

      const at = now();
      // A published event whose end has passed is completed, and completed is read-only.
      if (current.status === "published" && current.endAt < at) {
        throw new ConflictError(
          "EVENT_ENDED",
          "A completed event can no longer be edited",
        );
      }

      // The values the event will have: what was sent, else what it has.
      const startAt = body.startAt ?? current.startAt;
      const endAt = body.endAt ?? current.endAt;
      if (endAt <= startAt) {
        throw new ValidationError("Invalid request", {
          fieldErrors: { endAt: ["The event must end after it starts"] },
        });
      }
      const startMoved =
        body.startAt !== undefined &&
        body.startAt.getTime() !== current.startAt.getTime();
      if (startMoved && body.startAt && body.startAt <= at) {
        throw new ValidationError("Invalid request", {
          fieldErrors: { startAt: ["The event must start in the future"] },
        });
      }
      const datesChanged =
        startAt.getTime() !== current.startAt.getTime() ||
        endAt.getTime() !== current.endAt.getTime();

      const priceChanged =
        body.ticketPrice !== undefined &&
        body.ticketPrice !== current.ticketPrice;
      const venueChanged =
        body.venueId !== undefined && body.venueId !== current.venueId;
      const newCapacity = body.capacity ?? null;

      // Only count the registrations when a rule needs them.
      const registered =
        priceChanged || venueChanged || newCapacity !== null
          ? await repo.countRegistered(eventId)
          : 0;
      if (registered > 0 && priceChanged) {
        throw new ConflictError(
          "EVENT_HAS_REGISTRATIONS",
          "The ticket price can't change once people have registered",
        );
      }
      if (registered > 0 && venueChanged) {
        throw new ConflictError(
          "EVENT_HAS_REGISTRATIONS",
          "The venue can't change once people have registered",
        );
      }
      if (newCapacity !== null && newCapacity < registered) {
        throw new ConflictError(
          "CAPACITY_BELOW_REGISTERED",
          `${registered} people have registered, so the capacity can't be lower than that`,
        );
      }

      // The event happens where its venue is: the venue's zone becomes the event's.
      let timezone: string | undefined;
      if (venueChanged) {
        if (body.venueId) {
          const venue = await repo.findVenue(body.venueId);
          if (!venue) throw new NotFoundError("Venue not found");
          if (!venue.isActive) {
            throw new ConflictError(
              "VENUE_INACTIVE",
              "This venue is inactive. Choose an active venue",
            );
          }
          timezone = venue.timezone;
        }
        const strandedSessions = await repo.countSessionsInOtherVenue(
          eventId,
          body.venueId ?? null,
        );
        if (strandedSessions > 0) {
          throw new ConflictError(
            "SESSIONS_USE_OTHER_VENUE",
            "Some sessions are in halls of the current venue. Move or cancel them first",
          );
        }
      }

      if (datesChanged) {
        const outside = await repo.countSessionsOutside(
          eventId,
          startAt,
          endAt,
        );
        if (outside > 0) {
          throw new ConflictError(
            "SESSIONS_OUTSIDE_EVENT",
            "Some sessions fall outside the new dates. Move or cancel them first",
          );
        }
      }
      // "Null = closes when the event starts", so it cannot close after a start that moved.
      if (
        startMoved &&
        current.registrationClosesAt &&
        current.registrationClosesAt > startAt
      ) {
        throw new ConflictError(
          "REGISTRATION_CLOSES_AFTER_START",
          "Registration is set to close after the new start. Change the registration window first",
        );
      }

      // Field by field: nothing the client sent beyond these can reach the table.
      const patch: EventPatch = {};
      if (body.title !== undefined) patch.title = body.title;
      if (body.startAt !== undefined) patch.startAt = body.startAt;
      if (body.endAt !== undefined) patch.endAt = body.endAt;
      if (body.venueId !== undefined) patch.venueId = body.venueId;
      if (timezone !== undefined) patch.timezone = timezone;
      if (body.capacity !== undefined) patch.capacity = body.capacity;
      if (body.ticketPrice !== undefined) patch.ticketPrice = body.ticketPrice;

      const updated = await repo.updateEvent(eventId, patch);
      if (!updated) {
        throw new ConflictError(
          "EVENT_CHANGED",
          "The event was cancelled or changed while you were editing. Reload and try again",
        );
      }
      return toEventDto(updated);
    },

    //* The event's page in Strapi: its text content and images

    /** The edit form's current values (text content and images). */
    async getContent(
      eventId: string,
      actor: EventActor,
    ): Promise<EventContentDto> {
      const event = await access.requireEvent(eventId, actor, { write: false });
      return toEventContentDto(await loadPage(event));
    },

    /** Saves only the fields that were sent. Returns the full content as saved. */
    async updateContent(
      eventId: string,
      body: UpdateEventContentBody,
      actor: EventActor,
    ): Promise<EventContentDto> {
      const event = await access.requireEvent(eventId, actor, { write: true });
      const page = await saveToCms(event, toStrapiUpdate(body));
      return toEventContentDto(page);
    },

    /** Sets (or replaces) the cover image. The old file is removed only after the new one is saved. */
    async replaceCover(
      eventId: string,
      upload: ImageUpload,
      actor: EventActor,
    ): Promise<EventCoverDto> {
      // Before a single byte goes to Strapi: only someone who may edit this event can upload.
      const event = await access.requireEvent(eventId, actor, { write: true });
      const current = await loadPage(event);

      const image = await uploadOneImage(upload);
      const page = await saveImageToCms(event, image, { coverImage: image.id });

      const oldId = current?.coverImage?.id;
      if (oldId && oldId !== image.id) await removeUploadedFile(oldId);

      if (!page.coverImage) {
        throw new Error(
          `Strapi event page ${page.documentId} has no cover after setting one`,
        );
      }
      return { coverImage: toEventMediaDto(page.coverImage) };
    },

    /** Removes the cover image. No cover is not an error: the result is the same. */
    async removeCover(
      eventId: string,
      actor: EventActor,
    ): Promise<EventCoverDto> {
      const event = await access.requireEvent(eventId, actor, { write: true });
      const current = await loadPage(event);
      if (!current?.coverImage) return { coverImage: null };

      await saveToCms(event, { coverImage: null });
      await removeUploadedFile(current.coverImage.id);
      return { coverImage: null };
    },

    /**
     * Adds one image to the gallery (at most EVENT_GALLERY_MAX_IMAGES). Read, append, write:
     * two uploads at the very same moment could lose one, which is acceptable for one
     * organizer editing their own event.
     */
    async addGalleryImage(
      eventId: string,
      upload: ImageUpload,
      actor: EventActor,
    ): Promise<EventGalleryDto> {
      const event = await access.requireEvent(eventId, actor, { write: true });
      const gallery = (await loadPage(event))?.gallery ?? [];
      // Before the upload, so a full gallery does not cost a transfer.
      if (gallery.length >= EVENT_GALLERY_MAX_IMAGES) {
        throw new ConflictError(
          "GALLERY_FULL",
          `A gallery holds at most ${EVENT_GALLERY_MAX_IMAGES} images`,
        );
      }

      const image = await uploadOneImage(upload);
      const page = await saveImageToCms(event, image, {
        gallery: [...gallery.map((item) => item.id), image.id],
      });
      return { gallery: page.gallery.map(toEventMediaDto) };
    },

    /**
     * Removes one image from the gallery. `fileId` must be in THIS event's gallery, so nobody
     * can delete another event's (or any other) file by guessing an id: anything else is a 404.
     */
    async removeGalleryImage(
      eventId: string,
      fileId: number,
      actor: EventActor,
    ): Promise<EventGalleryDto> {
      const event = await access.requireEvent(eventId, actor, { write: true });
      const gallery = (await loadPage(event))?.gallery ?? [];
      if (!gallery.some((item) => item.id === fileId)) {
        throw new NotFoundError("Image not found");
      }

      const page = await saveToCms(event, {
        gallery: gallery
          .filter((item) => item.id !== fileId)
          .map((item) => item.id),
      });
      await removeUploadedFile(fileId);
      return { gallery: page.gallery.map(toEventMediaDto) };
    },
  };
}

export type EventService = ReturnType<typeof createEventService>;

export const eventService = createEventService({
  eventRepository,
  strapiClient: strapiEventClient,
  mediaClient: strapiMediaClient,
  organizerVerification: organizerService,
});
