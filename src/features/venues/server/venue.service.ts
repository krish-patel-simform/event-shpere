import "server-only";
import type { CurrentUser } from "../../../core/auth/server/auth-session";
// Direct file import: the core/http barrel also pulls in the route wrapper and cookies.
import { ConflictError, NotFoundError } from "../../../core/http/errors";
import type {
  CreateHallBody,
  CreateVenueBody,
  CreateVenueDto,
  HallDetailDto,
  SetHallsStatusBody,
  SetVenueStatusBody,
  VenueDetailDto,
  VenueListItemDto,
  VenueListQuery,
} from "../schemas/venue.schemas";
import {
  toHallDetailDto,
  toVenueDetailDto,
  toVenueDto,
  toVenueListItemDto,
} from "./venue.dto";
import { venueRepository, type VenueRepository } from "./venue.repository";

export type VenueServiceDeps = {
  venueRepository: Pick<
    VenueRepository,
    | "createVenue"
    | "listVenues"
    | "getVenueById"
    | "getHallById"
    | "setVenueActive"
    | "setHallsActive"
    | "addHall"
    | "deleteHall"
  >;
};

/** Who is asking: `canManage` is true for an admin holding the manage permission. */
export type ViewerAccess = { canManage: boolean };

export function createVenueService({ venueRepository }: VenueServiceDeps) {
  return {
    /**
     * An admin adds a venue with its halls. The permission (VENUE_MANAGE) is checked by the
     * route wrapper; the creator comes from the access token, never from the body.
     */
    async createVenue(
      body: CreateVenueBody,
      currentUser: Pick<CurrentUser, "id">,
    ): Promise<CreateVenueDto> {
      const result = await venueRepository.createVenue({
        ...body,
        createdBy: currentUser.id,
      });

      if (!result.ok) {
        // A well-formed uuid that is not in `states`: the client picked something that is gone.
        if (result.reason === "STATE_NOT_FOUND")
          throw new NotFoundError("State not found");
        throw new ConflictError(
          "VENUE_EXISTS",
          `A venue named "${body.name}" already exists in ${body.city}`,
        );
      }

      return toVenueDto(result.venue, result.halls);
    },

    /**
     * One page of venues, searched, filtered by status and sorted. A guest only ever gets
     * active venues (whatever `status` they ask for) and the counts include only active halls,
     * the same view as the detail; `canManage` (VENUE_MANAGE) sees every venue and hall.
     */
    async listVenues(
      query: VenueListQuery,
      { canManage }: ViewerAccess,
    ): Promise<{
      items: VenueListItemDto[];
      meta: { page: number; pageSize: number; total: number };
    }> {
      const { page, pageSize, search, status, state, sort } = query;

      const { rows, total } = await venueRepository.listVenues({
        // An empty search (after trim) counts as no search.
        search: search || undefined,
        state: state || undefined,
        status: canManage ? status : "active",
        sort,
        onlyActiveHalls: !canManage,
        // page/pageSize (what the caller asks) → limit/offset (what SQL needs).
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });

      return {
        items: rows.map(toVenueListItemDto),
        meta: { page, pageSize, total },
      };
    },

    /**
     * A venue with its hall list. A guest sees only an active venue and its active halls;
     * anything else is a 404 so an inactive venue's existence is not revealed.
     * `canManage` (VENUE_MANAGE) sees everything.
     */
    async getVenueDetail(
      venueId: string,
      { canManage }: ViewerAccess,
    ): Promise<VenueDetailDto> {
      const result = await venueRepository.getVenueById(venueId);
      if (!result || (!canManage && !result.venue.isActive)) {
        throw new NotFoundError("Venue not found");
      }

      const halls = canManage
        ? result.halls
        : result.halls.filter((hall) => hall.isActive);
      return toVenueDetailDto(result.venue, halls);
    },

    /**
     * One hall. A guest sees it only when both the hall and its venue are active (else 404);
     * `canManage` (HALL_MANAGE) sees it either way.
     */
    async getHallDetail(
      venueId: string,
      hallId: string,
      { canManage }: ViewerAccess,
    ): Promise<HallDetailDto> {
      const result = await venueRepository.getHallById(venueId, hallId);
      if (
        !result ||
        (!canManage && (!result.hall.isActive || !result.venue.isActive))
      ) {
        throw new NotFoundError("Hall not found");
      }

      return toHallDetailDto(result.hall, result.venue);
    },

    /** Activate or deactivate a venue (VENUE_MANAGE). Deactivating deactivates all its halls too. */
    async setVenueStatus(
      venueId: string,
      body: SetVenueStatusBody,
    ): Promise<VenueDetailDto> {
      const result = await venueRepository.setVenueActive(
        venueId,
        body.isActive,
        body.activateHalls,
      );
      if (!result) throw new NotFoundError("Venue not found");

      return toVenueDetailDto(result.venue, result.halls);
    },

    /** Activate or deactivate all halls, or the listed ones, of a venue (HALL_MANAGE). */
    async setHallsStatus(
      venueId: string,
      body: SetHallsStatusBody,
    ): Promise<VenueDetailDto> {
      const result = await venueRepository.setHallsActive(
        venueId,
        body.isActive,
        body.halls,
      );

      if (!result.ok) {
        switch (result.reason) {
          case "VENUE_NOT_FOUND":
            throw new NotFoundError("Venue not found");
          case "HALL_NOT_FOUND":
            // Also covers an id that belongs to another venue: never reveal which.
            throw new NotFoundError(
              "One or more halls were not found in this venue",
            );
          case "VENUE_INACTIVE":
            throw new ConflictError(
              "VENUE_INACTIVE",
              "Activate the venue before activating its halls",
            );
        }
      }

      return toVenueDetailDto(result.venue, result.halls);
    },

    /** Add one hall to an existing venue (HALL_MANAGE). Returns the venue with its updated halls. */
    async addHall(
      venueId: string,
      body: CreateHallBody,
    ): Promise<VenueDetailDto> {
      const result = await venueRepository.addHall(venueId, body);

      if (!result.ok) {
        switch (result.reason) {
          case "VENUE_NOT_FOUND":
            throw new NotFoundError("Venue not found");
          case "VENUE_INACTIVE":
            throw new ConflictError(
              "VENUE_INACTIVE",
              "Activate the venue before adding a hall to it",
            );
          case "HALL_EXISTS":
            throw new ConflictError(
              "HALL_EXISTS",
              `This venue already has a hall named "${body.name}"`,
            );
        }
      }

      return toVenueDetailDto(result.venue, result.halls);
    },

    /** Permanently delete one hall (HALL_MANAGE). Returns the venue with its remaining halls. */
    async deleteHall(venueId: string, hallId: string): Promise<VenueDetailDto> {
      const result = await venueRepository.deleteHall(venueId, hallId);

      if (!result.ok) {
        switch (result.reason) {
          case "VENUE_NOT_FOUND":
            throw new NotFoundError("Venue not found");
          case "HALL_NOT_FOUND":
            throw new NotFoundError("Hall not found");
          case "LAST_HALL":
            throw new ConflictError(
              "LAST_HALL",
              "A venue must keep at least one hall",
            );
          case "HALL_IN_USE":
            throw new ConflictError(
              "HALL_IN_USE",
              "Sessions are scheduled in this hall. Deactivate it instead of deleting it",
            );
        }
      }

      return toVenueDetailDto(result.venue, result.halls);
    },
  };
}

export type VenueService = ReturnType<typeof createVenueService>;

export const venueService = createVenueService({ venueRepository });
