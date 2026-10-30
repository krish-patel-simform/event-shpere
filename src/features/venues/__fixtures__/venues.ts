import type { CreateHallDto, VenueDetailDto } from "../schemas/venue.schemas";

export const venueId = "8c1f4f6e-2f4b-4c43-9a59-0d6f2a1b7e10";

export const hallIds = {
  main: "a0000000-0000-4000-8000-000000000001",
  workshop: "b0000000-0000-4000-8000-000000000002",
  lounge: "c0000000-0000-4000-8000-000000000003",
} as const;

export const mainAuditorium: CreateHallDto = {
  id: hallIds.main,
  name: "Main Auditorium",
  capacity: 300,
  sortOrder: 0,
  isActive: true,
};
export const workshopRoom: CreateHallDto = {
  id: hallIds.workshop,
  name: "Workshop Room 1",
  capacity: 80,
  sortOrder: 1,
  isActive: true,
};
export const rooftopLounge: CreateHallDto = {
  id: hallIds.lounge,
  name: "Rooftop Lounge",
  capacity: 60,
  sortOrder: 2,
  isActive: false,
};

/** An active venue with two halls on and one off. */
export const giftCity: VenueDetailDto = {
  id: venueId,
  name: "GIFT City Convention Centre",
  addressLine: "Block 12, Zone 1, GIFT City",
  city: "Gandhinagar",
  state: "Gujarat",
  postalCode: "382355",
  country: "IN",
  timezone: "Asia/Kolkata",
  latitude: 23.16,
  longitude: 72.68,
  isActive: true,
  halls: [mainAuditorium, workshopRoom, rooftopLounge],
};
