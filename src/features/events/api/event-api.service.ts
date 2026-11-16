// Calls to the events API, built on the shared axios instance. React Query hooks (../hooks) wrap
// these; components use the hooks.
import {
  apiRequest,
  apiRequestPage,
} from "../../../core/api-client/base-api.service";
import { fileUploadRequest } from "../../../core/api-client/file-upload";
import { EVENT_IMAGE_FORM_FIELD } from "../constants";
import {
  eventContentResponseSchema,
  eventCoverResponseSchema,
  eventGalleryResponseSchema,
  type EventContentDto,
  type EventCoverDto,
  type EventGalleryDto,
  type UpdateEventContentBody,
} from "../schemas/event-content.schemas";
import {
  eventOverviewSchema,
  eventTabCountsSchema,
  myEventListResponseSchema,
  type EventOverviewData,
  type EventSort,
  type EventTabCounts,
  type EventTabKey,
} from "../schemas/event-manage.schemas";
import {
  publicEventDetailSchema,
  publicEventListResponseSchema,
  type PublicEventDetailDto,
  type PublicEventListQuery,
} from "../schemas/event-public.schemas";
import {
  eventResponseSchema,
  type CreateEventRequest,
  type EventDto,
  type UpdateEventRequest,
} from "../schemas/events.schemas";

export type ListMyEventsParams = {
  /** The tab: one status, or "all". */
  status: EventTabKey;
  /** Matches the title. An empty text means no search. */
  search?: string;
  sort: EventSort;
  page?: number;
  pageSize: number;
};

/** What the browse page asks for; a left-out filter means the server does not filter by it. */
export type ListPublicEventsParams = Pick<PublicEventListQuery, "pageSize"> &
  Partial<Omit<PublicEventListQuery, "pageSize">>;

/** One image, or several, as multipart/form-data in the field the server reads. */
const imageUpload = (url: string, files: File | readonly File[]) =>
  fileUploadRequest(url, EVENT_IMAGE_FORM_FIELD, files);

export const eventApiService = {
  /**
   * One page of the events anyone can browse (published only), searched, filtered and sorted by
   * the server, and how many match in total. Needs no login.
   */
  listPublic({
    search,
    price,
    when,
    sort,
    page = 1,
    pageSize,
  }: ListPublicEventsParams) {
    return apiRequestPage(
      {
        method: "GET",
        url: "/events",
        // Only what is set goes into the URL, so the server's defaults apply to the rest.
        params: {
          page,
          pageSize,
          ...(search ? { search } : {}),
          ...(price ? { price } : {}),
          ...(when ? { when } : {}),
          ...(sort ? { sort } : {}),
        },
      },
      publicEventListResponseSchema,
    );
  },

  /** One event's public page by its link (404 for a draft or an unknown slug). */
  getPublic(slug: string): Promise<PublicEventDetailDto> {
    return apiRequest(
      { method: "GET", url: `/events/slug/${slug}` },
      publicEventDetailSchema,
    );
  },

  /** One page of the signed-in organizer's own events, and how many match in total. */
  listMine({ status, search, sort, page = 1, pageSize }: ListMyEventsParams) {
    return apiRequestPage(
      {
        method: "GET",
        url: "/me/events",
        params: {
          page,
          pageSize,
          status,
          sort,
          // Left out when not set, so the server does not filter by it.
          ...(search ? { search } : {}),
        },
      },
      myEventListResponseSchema,
    );
  },

  /** How many events each tab holds (whatever the search). */
  countMine(): Promise<EventTabCounts> {
    return apiRequest(
      { method: "GET", url: "/me/events/counts" },
      eventTabCountsSchema,
    );
  },

  /** One event with the figures its overview shows (404 if it is not the caller's). */
  getOverview(eventId: string): Promise<EventOverviewData> {
    return apiRequest(
      { method: "GET", url: `/events/${eventId}` },
      eventOverviewSchema,
    );
  },

  /** Creates a draft event. 503 CMS_UNAVAILABLE if its page could not be created. */
  create(body: CreateEventRequest): Promise<EventDto> {
    return apiRequest(
      { method: "POST", url: "/events", data: body },
      eventResponseSchema,
    );
  },

  /** Changes the event's details. 409 with a code when the event does not allow the change. */
  update(eventId: string, body: UpdateEventRequest): Promise<EventDto> {
    return apiRequest(
      { method: "PATCH", url: `/events/${eventId}`, data: body },
      eventResponseSchema,
    );
  },

  /**
   * Cancels a published event (final). Its sessions, session bookings and registrations are
   * cancelled with it. 409 when the event is a draft or already completed.
   */
  cancel(eventId: string): Promise<EventDto> {
    return apiRequest(
      { method: "POST", url: `/events/${eventId}/cancel` },
      eventResponseSchema,
    );
  },

  /**
   * Deletes the organizer's own draft for good (204, no body): the event, its sessions, and its
   * page, session entries and images in the CMS. 409 `EVENT_NOT_DRAFT` when it is published or
   * cancelled, 404 when it is not theirs or already gone, 503 `CMS_UNAVAILABLE` (nothing deleted)
   * when the CMS cannot be read first.
   */
  remove(eventId: string): Promise<void> {
    return apiRequest({ method: "DELETE", url: `/events/${eventId}` });
  },

  /**
   * Publishes the organizer's own draft. 409 EVENT_NOT_READY (with `details.missing`) when
   * something is still missing; 409 when it is cancelled or has ended.
   */
  publish(eventId: string): Promise<EventDto> {
    return apiRequest(
      { method: "POST", url: `/events/${eventId}/publish` },
      eventResponseSchema,
    );
  },

  /** The event page's text and images (Strapi). */
  getContent(eventId: string): Promise<EventContentDto> {
    return apiRequest(
      { method: "GET", url: `/events/${eventId}/content` },
      eventContentResponseSchema,
    );
  },

  /** Saves the page's text. Only the fields in the body change. */
  updateContent(
    eventId: string,
    body: UpdateEventContentBody,
  ): Promise<EventContentDto> {
    return apiRequest(
      { method: "PATCH", url: `/events/${eventId}/content`, data: body },
      eventContentResponseSchema,
    );
  },

  /** Sets or replaces the cover image. */
  uploadCover(eventId: string, file: File): Promise<EventCoverDto> {
    return apiRequest(
      imageUpload(`/events/${eventId}/cover`, file),
      eventCoverResponseSchema,
    );
  },

  /** Removes the cover image (204, no body). */
  deleteCover(eventId: string): Promise<void> {
    return apiRequest({ method: "DELETE", url: `/events/${eventId}/cover` });
  },

  /**
   * Adds one or more images to the gallery in ONE request (409 `GALLERY_FULL` when they do not
   * all fit, and then none is kept). Returns the whole gallery.
   */
  addGalleryImages(
    eventId: string,
    files: readonly File[],
  ): Promise<EventGalleryDto> {
    return apiRequest(
      imageUpload(`/events/${eventId}/gallery`, files),
      eventGalleryResponseSchema,
    );
  },

  /** Removes one gallery image. Returns the images that are left. */
  deleteGalleryImage(
    eventId: string,
    fileId: number,
  ): Promise<EventGalleryDto> {
    return apiRequest(
      { method: "DELETE", url: `/events/${eventId}/gallery/${fileId}` },
      eventGalleryResponseSchema,
    );
  },
};
