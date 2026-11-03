// Calls to the events API, built on the shared axios instance. React Query hooks (../hooks) wrap
// these; components use the hooks.
import {
  apiRequest,
  apiRequestPage,
} from "../../../core/api-client/base-api.service";
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

/**
 * One image as multipart/form-data. The JSON content type of the shared client is cleared, so
 * the browser sets `multipart/form-data` with its boundary itself.
 */
function imageUpload(url: string, file: File) {
  const data = new FormData();
  data.append(EVENT_IMAGE_FORM_FIELD, file);
  return {
    method: "POST",
    url,
    data,
    headers: { "Content-Type": undefined },
  } as const;
}

export const eventApiService = {
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

  /** Adds one image to the gallery (409 when it already holds the most). Returns the gallery. */
  addGalleryImage(eventId: string, file: File): Promise<EventGalleryDto> {
    return apiRequest(
      imageUpload(`/events/${eventId}/gallery`, file),
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
