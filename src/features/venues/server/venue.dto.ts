import "server-only";
import type { Hall, Venue } from "../../../db/schemas";
import type {
  CreateHallDto,
  CreateVenueDto,
  HallDetailDto,
  VenueDetailDto,
  VenueListItemDto,
} from "../schemas/venue.schemas";
import type { VenueRepository } from "./venue.repository";

/** One row of the venue list as the repository returns it (counts already worked out in SQL). */
export type VenueListRow = Awaited<
  ReturnType<VenueRepository["listVenues"]>
>["rows"][number];

/** Picks fields one by one, so no column added to the table later leaves by accident. */
export function toVenueListItemDto(row: VenueListRow): VenueListItemDto {
  return {
    id: row.id,
    name: row.name,
    addressLine: row.addressLine,
    city: row.city,
    state: row.state,
    country: row.country,
    timezone: row.timezone,
    isActive: row.isActive,
    hallCount: row.hallCount,
    hallsOn: row.hallsOn,
    totalSeats: row.totalSeats,
  };
}

function toHallDto(hall: Hall): CreateHallDto {
  return {
    id: hall.id,
    name: hall.name,
    capacity: hall.capacity,
    sortOrder: hall.sortOrder,
    isActive: hall.isActive,
  };
}

// RETURNING / SELECT without ORDER BY does not promise an order: sort so the response is stable.
function toHallDtos(halls: Hall[]): CreateHallDto[] {
  return [...halls].sort((a, b) => a.sortOrder - b.sortOrder).map(toHallDto);
}

// Picks fields one by one: createdBy and any column added later never leave by accident.
function toVenueFields(venue: Venue): Omit<VenueDetailDto, "halls"> {
  return {
    id: venue.id,
    name: venue.name,
    addressLine: venue.addressLine,
    city: venue.city,
    state: venue.state,
    postalCode: venue.postalCode,
    country: venue.country,
    timezone: venue.timezone,
    // numeric columns come back from Postgres as strings.
    latitude: venue.latitude === null ? null : Number(venue.latitude),
    longitude: venue.longitude === null ? null : Number(venue.longitude),
    isActive: venue.isActive,
  };
}

export function toVenueDto(venue: Venue, halls: Hall[]): CreateVenueDto {
  return {
    ...toVenueFields(venue),
    createdAt: venue.createdAt.toISOString(),
    halls: toHallDtos(halls),
  };
}

/** One hall plus a short summary of its venue (not the venue's other fields or halls). */
export function toHallDetailDto(hall: Hall, venue: Venue): HallDetailDto {
  return {
    ...toHallDto(hall),
    createdAt: hall.createdAt.toISOString(),
    venue: {
      id: venue.id,
      name: venue.name,
      city: venue.city,
      isActive: venue.isActive,
    },
  };
}

/** Venue detail: the venue and its hall list (not each hall's own detail). */
export function toVenueDetailDto(venue: Venue, halls: Hall[]): VenueDetailDto {
  return { ...toVenueFields(venue), halls: toHallDtos(halls) };
}
