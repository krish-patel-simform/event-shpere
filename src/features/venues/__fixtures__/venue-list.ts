import type { PageMeta } from "../../../core/api-client/base-api.service";
import type { ListVenuesParams } from "../api/venue-api.service";
import type { VenueListItemDto } from "../schemas/venue.schemas";

/** Venues the list tests start with, newest first (the order "Newest first" shows them in). */
export const LIST_VENUES: readonly VenueListItemDto[] = [
  {
    id: "8c1f4f6e-2f4b-4c43-9a59-0d6f2a1b7e10",
    name: "GIFT City Convention Centre",
    addressLine: "Block 12, Zone 1, GIFT City",
    city: "Gandhinagar",
    state: "Gujarat",
    country: "IN",
    timezone: "Asia/Kolkata",
    isActive: true,
    hallCount: 4,
    hallsOn: 3,
    totalSeats: 520,
  },
  {
    id: "2b7d0c3a-5e1f-4a86-8d34-9c1e6f0a4b21",
    name: "Riverfront Exhibition Hall",
    addressLine: "Sabarmati Riverfront, Ashram Road",
    city: "Ahmedabad",
    state: "Gujarat",
    country: "IN",
    timezone: "Asia/Kolkata",
    isActive: true,
    hallCount: 2,
    hallsOn: 2,
    totalSeats: 340,
  },
  {
    id: "5f3a9e12-7b4c-4d08-a6e5-1d2c3b4a5f60",
    name: "Lakeside Conference Centre",
    addressLine: "12 Lake Road, Hinjewadi",
    city: "Pune",
    state: "Maharashtra",
    country: "IN",
    timezone: "Asia/Kolkata",
    isActive: true,
    hallCount: 3,
    hallsOn: 3,
    totalSeats: 410,
  },
  {
    id: "a1e8c4d7-3f20-4b95-9d16-7e8f9a0b1c32",
    name: "Harbour View Hotel & Events",
    addressLine: "Marine Drive, Churchgate",
    city: "Mumbai",
    state: "Maharashtra",
    country: "IN",
    timezone: "Asia/Kolkata",
    isActive: true,
    hallCount: 5,
    hallsOn: 4,
    totalSeats: 880,
  },
  {
    id: "c9d2b6f1-4a38-4e7c-8b05-2f3a4b5c6d43",
    name: "Orchard Tech Park Auditorium",
    addressLine: "Whitefield Main Road",
    city: "Bengaluru",
    state: "Karnataka",
    country: "IN",
    timezone: "Asia/Kolkata",
    isActive: true,
    hallCount: 2,
    hallsOn: 2,
    totalSeats: 650,
  },
  {
    id: "e4b7a3c9-1d52-4f86-b0a7-3a4b5c6d7e54",
    name: "Old Mill Community Hall",
    addressLine: "4 Mill Lane, Naroda",
    city: "Ahmedabad",
    state: "Gujarat",
    country: "IN",
    timezone: "Asia/Kolkata",
    isActive: false,
    hallCount: 2,
    hallsOn: 0,
    totalSeats: 150,
  },
];

/**
 * A fake of GET /api/venues for screen tests: filters by status, searches name and city, sorts
 * and pages like the real route does.
 */
export function fakeListVenues({
  status,
  search = "",
  sort = "name",
  page = 1,
  pageSize,
}: ListVenuesParams): { items: VenueListItemDto[]; meta: PageMeta } {
  const needle = search.trim().toLowerCase();
  const matching = LIST_VENUES.filter((venue) =>
    status === undefined ? true : venue.isActive === (status === "active"),
  )
    .filter(
      (venue) =>
        needle === "" ||
        venue.name.toLowerCase().includes(needle) ||
        venue.city.toLowerCase().includes(needle),
    )
    .sort((a, b) => {
      if (sort === "halls") return b.hallCount - a.hallCount;
      if (sort === "newest") {
        return LIST_VENUES.indexOf(a) - LIST_VENUES.indexOf(b);
      }
      return a.name.localeCompare(b.name);
    });

  return {
    items: matching.slice((page - 1) * pageSize, page * pageSize),
    meta: { page, pageSize, total: matching.length },
  };
}
