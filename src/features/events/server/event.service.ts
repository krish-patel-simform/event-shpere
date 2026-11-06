import "server-only";
import { randomUUID } from "node:crypto";
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
  createImageUploader,
  strapiEventClient,
  strapiMediaClient,
  strapiSessionClient,
  type StrapiEventClient,
  type StrapiMediaClient,
  type StrapiSessionClient,
} from "../../cms/server";
import {
  organizerService,
  type OrganizerService,
} from "../../organizer/server";
import { EVENT_GALLERY_MAX_IMAGES } from "../constants";
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
  PublicEventDetailDto,
  PublicEventListItemDto,
  PublicEventListQuery,
} from "../schemas/event-public.schemas";
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
  toPublicEventDetailDto,
  toPublicEventListItemDto,
} from "./event.dto";
import {
  eventRepository,
  type EventPatch,
  type EventRef,
  type EventRepository,
} from "./event.repository";
import { getPublishChecklist } from "../utils/publish-checklist";
import { createEventAccess, type EventActor } from "./event-access";
import { EVENT_IMAGE_POLICY, type ImageUpload } from "./event-image";

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
    | "cancelEvent"
    | "listSessionCmsIds"
    | "deleteDraftEvent"
    | "publishEvent"
    | "listPublicEvents"
    | "findPublicEventBySlug"
    | "listPublicSessions"
  >;
  /** The event's page in Strapi: its text content. */
  strapiClient: Pick<
    StrapiEventClient,
    | "createEventPage"
    | "deleteEventPage"
    | "findEventPageById"
    | "findEventPagesByIds"
    | "updateEventPage"
  >;
  /**
   * The sessions' Session Detail entries in Strapi: read for their cover file and removed when a
   * draft event is deleted. (The sessions feature imports events, so the events service uses the
   * Strapi client itself, not the sessions service.)
   */
  sessionStrapiClient: Pick<
    StrapiSessionClient,
    "findSessionDetailById" | "deleteSessionDetail"
  >;
  /** Strapi's media library: the image uploads and removing replaced or deleted files. */
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

const notDraft = () =>
  new ConflictError(
    "EVENT_NOT_DRAFT",
    "Only a draft event can be deleted. Cancel a published event instead.",
  );

const invalidImage = () =>
  new ValidationError(
    "The image must be one JPEG, PNG or WebP file of at most 4 MB",
  );

// A gallery upload may hold several files, but all of them travel in one request, so the 4 MB
// is for the whole upload, not for each image.
const invalidGalleryImages = () =>
  new ValidationError(
    "Send JPEG, PNG or WebP images, at most 4 MB in total in one upload",
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

  /**
   * A Strapi read the PUBLIC pages can do without: a failure is logged (message only) and the
   * page goes on with `fallback`, so a visitor still sees the facts from Postgres (title, dates,
   * venue, price) when the CMS is down. The organizer's own screens use requireCms instead.
   */
  async function withoutCmsOnFailure<T>(
    what: string,
    fallback: T,
    load: () => Promise<T>,
  ): Promise<T> {
    try {
      return await load();
    } catch (error) {
      console.error(
        `[events] CMS content for ${what} not loaded, showing the facts only:`,
        error instanceof Error ? error.message : error,
      );
      return fallback;
    }
  }

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
   * The ids of every media file a draft event uses in Strapi: the page's cover and gallery and
   * each session's cover. Strapi does NOT remove a file when the entry that uses it is deleted,
   * and the ids exist only inside the entries, so they are read BEFORE the delete. Any Strapi
   * failure is a 503 and nothing is deleted: without the ids the files could never be found again.
   */
  async function collectCmsFileIds(
    event: EventRef,
    sessionCmsIds: string[],
  ): Promise<number[]> {
    return requireCms("read before delete", async () => {
      const [page, details] = await Promise.all([
        event.cmsEventId
          ? deps.strapiClient.findEventPageById(event.cmsEventId)
          : null,
        Promise.all(
          sessionCmsIds.map((id) =>
            deps.sessionStrapiClient.findSessionDetailById(id),
          ),
        ),
      ]);
      const ids = [
        page?.coverImage?.id,
        ...(page?.gallery ?? []).map((image) => image.id),
        ...details.map((detail) => detail?.coverImage?.id),
      ];
      return [...new Set(ids.filter((id): id is number => id !== undefined))];
    });
  }

  /**
   * Removes a deleted draft's content from Strapi: its page, its sessions' entries and every
   * media file. Best effort, each step on its own: the event is already gone from Postgres, so
   * the organizer's delete has succeeded, and a Strapi failure only leaves something nothing
   * points to. It is logged by id (no event data) so it can be removed by hand.
   */
  async function removeDeletedEventFromCms(
    pageId: string | null,
    sessionCmsIds: string[],
    fileIds: number[],
  ) {
    const attempt = async (what: string, remove: () => Promise<void>) => {
      try {
        await remove();
      } catch (error) {
        console.error(
          `[events] orphan Strapi ${what} not deleted:`,
          error instanceof Error ? error.message : error,
        );
      }
    };
    await Promise.all([
      ...(pageId
        ? [
            attempt(`event page ${pageId}`, () =>
              deps.strapiClient.deleteEventPage(pageId),
            ),
          ]
        : []),
      ...sessionCmsIds.map((id) =>
        attempt(`session detail ${id}`, () =>
          deps.sessionStrapiClient.deleteSessionDetail(id),
        ),
      ),
      ...fileIds.map((id) =>
        attempt(`media file ${id}`, () => deps.mediaClient.deleteFile(id)),
      ),
    ]);
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

  // Streaming an upload to Strapi, checking what it stored and deleting bad files is the same
  // for every feature: it lives in the cms feature. Events only bring their limits and wording.
  const { uploadImages, uploadOneImage, removeUploadedFile } =
    createImageUploader({
      mediaClient: deps.mediaClient,
      policy: EVENT_IMAGE_POLICY,
      scope: "events",
      noun: "image",
      invalid: invalidImage,
      unavailable: cmsUnavailable,
    });

  /** saveToCms for images that were just uploaded: if saving fails, the new files are removed. */
  async function saveImageToCms(
    event: EventRef,
    images: readonly StrapiUploadedFile[],
    data: StrapiEventPageUpdate,
  ): Promise<CmsEventPage> {
    try {
      return await saveToCms(event, data);
    } catch (error) {
      await Promise.all(images.map((image) => removeUploadedFile(image.id)));
      throw error;
    }
  }

  return {
    //* The public side (discovery): open to everyone, so nothing here checks an owner. Which
    //* events are visible is decided by the repository's queries (published; a cancelled one only
    //* on its own page); a draft is a 404, exactly like an unknown link.

    /**
     * One page of the events anyone can browse (published only). Postgres decides WHICH events
     * are listed (filter, order, total); Strapi only adds each card's tagline and banner,
     * fetched for the whole page in one call. If Strapi fails the cards simply have no banner.
     */
    async listPublicEvents(
      query: PublicEventListQuery,
    ): Promise<{ items: PublicEventListItemDto[]; meta: PageMeta }> {
      const { page, pageSize } = query;

      const { rows, total } = await repo.listPublicEvents({
        // An empty value after trim counts as no search.
        search: query.search || undefined,
        price: query.price,
        when: query.when,
        sort: query.sort,
        now: now(),
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });

      const documentIds = rows.flatMap((row) =>
        row.cmsEventId ? [row.cmsEventId] : [],
      );
      const pages = await withoutCmsOnFailure("the event list", [], () =>
        deps.strapiClient.findEventPagesByIds(documentIds),
      );
      const pageById = new Map(pages.map((item) => [item.documentId, item]));

      return {
        items: rows.map((row) =>
          toPublicEventListItemDto(
            row,
            (row.cmsEventId && pageById.get(row.cmsEventId)) || null,
          ),
        ),
        meta: { page, pageSize, total },
      };
    },

    /**
     * One event's public page, found by its link. A published event, or a cancelled one (it stays
     * visible with a banner); a draft or an unknown link is a 404. The facts and the sessions
     * come from Postgres, the written content from Strapi, read in parallel; if Strapi fails the
     * page still has the facts and the sessions, with `content: null`.
     */
    async getPublicEvent(slug: string): Promise<PublicEventDetailDto> {
      const row = await repo.findPublicEventBySlug(slug);
      if (!row) throw new NotFoundError("Event not found");

      const { cmsEventId } = row;
      const [page, sessions] = await Promise.all([
        cmsEventId
          ? withoutCmsOnFailure(`event ${cmsEventId}`, null, () =>
              deps.strapiClient.findEventPageById(cmsEventId),
            )
          : Promise.resolve(null),
        repo.listPublicSessions(row.id),
      ]);
      return toPublicEventDetailDto(row, page, sessions);
    },

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
      const ref = await access.getEventIfOrgOwns(eventId, actor, {
        write: false,
      });
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
      // The whole event row: the access check already read it, so there is no second lookup.
      const current = await access.getEventIfOrgOwns(eventId, actor, {
        write: true,
      });

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

    /**
     * Cancels a published event: its sessions are cancelled with it (so their halls are free
     * again), and so are all the seats booked for the sessions and all the registrations for the
     * event, in one transaction. Cancelling is final. Only the organizer who owns the event may
     * do it: the route requires EVENT_MANAGE_OWN, and the service refuses anyone who is not an
     * organizer even if that permission were ever granted (an admin cancels nothing). Someone
     * else's event is a 404.
     *
     * - already cancelled: answered as it is (cancelling twice is harmless)
     * - a draft: 409 EVENT_NOT_PUBLISHED (a draft is deleted, not cancelled)
     * - ended (completed, read-only): 409 EVENT_ENDED
     * The Strapi page stays. Refunds and messages to attendees are not done here.
     */
    async cancelEvent(eventId: string, actor: EventActor): Promise<EventDto> {
      if (actor.role !== "organizer") {
        throw new ForbiddenError("Only the organizer can cancel an event");
      }
      // write: false, so an event that is already cancelled gets its answer instead of a 409. The
      // whole event row comes back, so there is no second lookup.
      const current = await access.getEventIfOrgOwns(eventId, actor, {
        write: false,
      });

      if (current.status === "cancelled") return toEventDto(current);
      if (current.status === "draft") {
        throw new ConflictError(
          "EVENT_NOT_PUBLISHED",
          "A draft event is deleted, not cancelled",
        );
      }
      const at = now();
      if (current.endAt < at) {
        throw new ConflictError(
          "EVENT_ENDED",
          "A completed event can no longer be cancelled",
        );
      }

      const cancelled = await repo.cancelEvent(eventId, at);
      if (cancelled) return toEventDto(cancelled);

      // Someone cancelled it between the read and the write: the answer is the same.
      const latest = await repo.findEventRecord(eventId);
      if (!latest) throw new NotFoundError("Event not found");
      return toEventDto(latest);
    },

    /**
     * Deletes the organizer's OWN draft for good: the event and its sessions in Postgres, and its
     * page, its sessions' entries and every media file (cover, gallery, session covers) in Strapi.
     * Only a draft can be deleted (a published event is cancelled): anything else is 409
     * EVENT_NOT_DRAFT. Only the organizer who owns it may do it: the route requires
     * EVENT_MANAGE_OWN, the service refuses anyone who is not an organizer (an admin deletes
     * nothing), and someone else's event is a 404.
     *
     * Order: check → read the media ids from Strapi (503 and nothing deleted if it cannot answer)
     * → delete in Postgres in one transaction (the source of truth) → remove the content from
     * Strapi, best effort. Deleting twice is a 404 the second time: the event is gone.
     */
    async deleteEvent(eventId: string, actor: EventActor): Promise<void> {
      if (actor.role !== "organizer") {
        throw new ForbiddenError("Only the organizer can delete an event");
      }
      const current = await access.getEventIfOrgOwns(eventId, actor, {
        write: false,
      });
      if (current.status !== "draft") throw notDraft();

      const fileIds = await collectCmsFileIds(
        current,
        await repo.listSessionCmsIds(eventId),
      );

      const deleted = await repo.deleteDraftEvent(eventId);
      if (deleted === "in_use") {
        throw new ConflictError(
          "EVENT_HAS_REGISTRATIONS",
          "This event has registrations and cannot be deleted",
        );
      }
      if (!deleted) {
        // Not a draft any more (published a moment ago), or deleted by another request.
        const latest = await repo.findEventRecord(eventId);
        throw latest ? notDraft() : new NotFoundError("Event not found");
      }

      await removeDeletedEventFromCms(
        deleted.event.cmsEventId,
        deleted.sessionCmsIds,
        fileIds,
      );
    },

    /**
     * Publishes the organizer's OWN draft, so attendees can find it and register.
     *
     * Who: only the organizer who owns the event (EVENT_PUBLISH_OWN, checked by the route). An
     * admin may hold EVENT_PUBLISH_ALL, but an admin does not publish: the service refuses them
     * too, and someone else's event is a 404.
     *
     * What must be true, all re-checked here (the screen's checklist is never trusted):
     * - it is a draft that has not ended (already published: answered as it is; cancelled: 409)
     * - its venue is still active, and has at least one active hall
     * - the page has a description (cover and gallery are optional: a placeholder is shown). If
     *   the CMS cannot answer, it is a 503: an event is never published on a guess
     * - it has a live session, and no session is still a draft (every session has its slot)
     * - every session is inside the event's dates and in a hall of its venue
     * A missing item is 409 EVENT_NOT_READY with the list of what is missing.
     */
    async publishEvent(eventId: string, actor: EventActor): Promise<EventDto> {
      if (actor.role !== "organizer") {
        throw new ForbiddenError("Only the organizer can publish an event");
      }
      const current = await access.getEventIfOrgOwns(eventId, actor, {
        write: false,
      });

      if (current.status === "published") return toEventDto(current);
      if (current.status === "cancelled") {
        throw new ConflictError(
          "EVENT_CANCELLED",
          "A cancelled event can't be published",
        );
      }
      const at = now();
      if (current.endAt <= at) {
        throw new ConflictError(
          "EVENT_ENDED",
          "An event that has already ended can't be published",
        );
      }

      if (current.venueId) {
        const venue = await repo.findVenue(current.venueId);
        if (!venue?.isActive) {
          throw new ConflictError(
            "VENUE_INACTIVE",
            "This event's venue is inactive. Choose an active venue",
          );
        }
      }

      const [row, extras, content] = await Promise.all([
        repo.findManagedEvent(eventId),
        repo.getOverviewExtras(eventId, current.venueId),
        loadContentFlags(current.cmsEventId),
      ]);
      if (!row) throw new NotFoundError("Event not found");
      if (content === null) throw cmsUnavailable();

      const checklist = getPublishChecklist({
        eventId,
        hasVenue: current.venueId !== null,
        hallCount: extras.hallNames.length,
        content,
        sessions: {
          total: row.sessionsTotal,
          scheduled: row.sessionsScheduled,
          cancelled: row.sessionsCancelled,
        },
      });
      if (!checklist.canPublish) {
        throw new ConflictError(
          "EVENT_NOT_READY",
          checklist.summary ?? "The event is not ready to publish",
          { missing: checklist.missing },
        );
      }

      // Updates already keep sessions inside the dates and the venue; this is the last look
      // before attendees can see them.
      const [outside, otherVenue] = await Promise.all([
        repo.countSessionsOutside(eventId, current.startAt, current.endAt),
        repo.countSessionsInOtherVenue(eventId, current.venueId),
      ]);
      if (outside > 0) {
        throw new ConflictError(
          "SESSIONS_OUTSIDE_DATES",
          "Some sessions fall outside the event's dates. Move them first",
        );
      }
      if (otherVenue > 0) {
        throw new ConflictError(
          "SESSIONS_IN_OTHER_VENUE",
          "Some sessions are in a hall of another venue. Move them first",
        );
      }

      const published = await repo.publishEvent(eventId, at);
      if (published) return toEventDto(published);

      // It stopped being a draft between the read and the write.
      const latest = await repo.findEventRecord(eventId);
      if (!latest) throw new NotFoundError("Event not found");
      if (latest.status === "published") return toEventDto(latest);
      throw new ConflictError(
        "EVENT_NOT_DRAFT",
        "This event can't be published any more",
      );
    },

    //* The event's page in Strapi: its text content and images

    /** The edit form's current values (text content and images). */
    async getContent(
      eventId: string,
      actor: EventActor,
    ): Promise<EventContentDto> {
      const event = await access.getEventIfOrgOwns(eventId, actor, {
        write: false,
      });
      return toEventContentDto(await loadPage(event));
    },

    /** Saves only the fields that were sent. Returns the full content as saved. */
    async updateContent(
      eventId: string,
      body: UpdateEventContentBody,
      actor: EventActor,
    ): Promise<EventContentDto> {
      const event = await access.getEventIfOrgOwns(eventId, actor, {
        write: true,
      });
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
      const event = await access.getEventIfOrgOwns(eventId, actor, {
        write: true,
      });
      const current = await loadPage(event);

      const image = await uploadOneImage(upload);
      const page = await saveImageToCms(event, [image], {
        coverImage: image.id,
      });

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
      const event = await access.getEventIfOrgOwns(eventId, actor, {
        write: true,
      });
      const current = await loadPage(event);
      if (!current?.coverImage) return { coverImage: null };

      await saveToCms(event, { coverImage: null });
      await removeUploadedFile(current.coverImage.id);
      return { coverImage: null };
    },

    /**
     * Adds one or more images to the gallery in ONE request (at most EVENT_GALLERY_MAX_IMAGES in
     * all). They are saved whole or not at all: a bad file, or more images than there is room
     * for, stores none of them. Read, append, write: two uploads at the very same moment could
     * lose some, which is acceptable for one organizer editing their own event.
     */
    async addGalleryImages(
      eventId: string,
      upload: ImageUpload,
      actor: EventActor,
    ): Promise<EventGalleryDto> {
      const event = await access.getEventIfOrgOwns(eventId, actor, {
        write: true,
      });
      const gallery = (await loadPage(event))?.gallery ?? [];
      const room = EVENT_GALLERY_MAX_IMAGES - gallery.length;
      // Before the upload, so a full gallery does not cost a transfer.
      if (room <= 0) {
        throw new ConflictError(
          "GALLERY_FULL",
          `A gallery holds at most ${EVENT_GALLERY_MAX_IMAGES} images`,
        );
      }

      const images = await uploadImages(upload, invalidGalleryImages);
      // The number of files is only known once Strapi has them: too many are removed again.
      if (images.length > room) {
        await Promise.all(images.map((image) => removeUploadedFile(image.id)));
        throw new ConflictError(
          "GALLERY_FULL",
          `A gallery holds at most ${EVENT_GALLERY_MAX_IMAGES} images; there is room for ${room} more`,
        );
      }

      const page = await saveImageToCms(event, images, {
        gallery: [
          ...gallery.map((item) => item.id),
          ...images.map((image) => image.id),
        ],
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
      const event = await access.getEventIfOrgOwns(eventId, actor, {
        write: true,
      });
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

/** The shared "who may touch which event" rule, for other features' services (sessions). */
export const eventAccess = createEventAccess({
  eventRepository,
  organizerVerification: organizerService,
});

export const eventService = createEventService({
  eventRepository,
  strapiClient: strapiEventClient,
  sessionStrapiClient: strapiSessionClient,
  mediaClient: strapiMediaClient,
  organizerVerification: organizerService,
});
