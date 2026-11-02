// Calls to the venue API, built on the shared axios instance. React Query hooks (../hooks) wrap
// these; components use the hooks.
import {
  apiRequest,
  apiRequestPage,
} from "../../../core/api-client/base-api.service";
import {
  createVenueResponseSchema,
  venueDetailResponseSchema,
  venueListResponseSchema,
  type CreateHallBody,
  type CreateVenueBody,
  type CreateVenueDto,
  type SetHallsStatusBody,
  type SetVenueStatusBody,
  type VenueDetailDto,
  type VenueSort,
  type VenueStatusFilter,
} from "../schemas/venue.schemas";

export type ListVenuesParams = {
  /** Left out = every venue, active or inactive (a guest always gets active ones). */
  status?: VenueStatusFilter;
  /** Matches the venue name or the city. An empty text means no search. */
  search?: string;
  /** Only venues in the state with this name, e.g. "Gujarat". */
  state?: string;
  /** The server defaults to name A–Z. */
  sort?: VenueSort;
  page?: number;
  pageSize: number;
};

export const venueApiService = {
  /** One page of venues (with their hall counts) and how many match in total. */
  list({ status, search, state, sort, page = 1, pageSize }: ListVenuesParams) {
    return apiRequestPage(
      {
        method: "GET",
        url: "/venues",
        params: {
          page,
          pageSize,
          // Left out when not set, so the server does not filter or reorder by it.
          ...(status ? { status } : {}),
          ...(search ? { search } : {}),
          ...(state ? { state } : {}),
          ...(sort ? { sort } : {}),
        },
      },
      venueListResponseSchema,
    );
  },

  /** One venue with its halls (404 if unknown, or inactive and you are not an admin). */
  get(venueId: string): Promise<VenueDetailDto> {
    return apiRequest(
      { method: "GET", url: `/venues/${venueId}` },
      venueDetailResponseSchema,
    );
  },

  /** Creates a venue with its halls. 409 VENUE_EXISTS if the name is taken in that city. */
  create(body: CreateVenueBody): Promise<CreateVenueDto> {
    return apiRequest(
      { method: "POST", url: "/venues", data: body },
      createVenueResponseSchema,
    );
  },

  /** Activates or deactivates a venue. Deactivating deactivates every hall; activating keeps them inactive unless asked. */
  setStatus(
    venueId: string,
    body: SetVenueStatusBody,
  ): Promise<VenueDetailDto> {
    return apiRequest(
      { method: "PATCH", url: `/venues/${venueId}/status`, data: body },
      venueDetailResponseSchema,
    );
  },

  /** Activates or deactivates halls: every hall ("all") or the listed ids. 409 VENUE_INACTIVE when activating a hall of an inactive venue. */
  setHallsStatus(
    venueId: string,
    body: SetHallsStatusBody,
  ): Promise<VenueDetailDto> {
    return apiRequest(
      { method: "PATCH", url: `/venues/${venueId}/halls/status`, data: body },
      venueDetailResponseSchema,
    );
  },

  /** Adds a hall. 409 HALL_EXISTS (same name) or VENUE_INACTIVE (venue inactive). */
  addHall(venueId: string, body: CreateHallBody): Promise<VenueDetailDto> {
    return apiRequest(
      { method: "POST", url: `/venues/${venueId}/halls`, data: body },
      venueDetailResponseSchema,
    );
  },

  /** Deletes a hall. 409 LAST_HALL (the venue's only one) or HALL_IN_USE (sessions use it). */
  deleteHall(venueId: string, hallId: string): Promise<VenueDetailDto> {
    return apiRequest(
      { method: "DELETE", url: `/venues/${venueId}/halls/${hallId}` },
      venueDetailResponseSchema,
    );
  },
};
