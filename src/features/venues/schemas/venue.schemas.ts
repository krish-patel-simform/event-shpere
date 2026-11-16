import { z } from "zod";
import { COUNTRY_REGEX } from "../constants";

// Also used by the add-venue form, so the browser and the server accept the same names.
export const timezoneSchema = z
  .string()
  .trim()
  .refine((tz) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "Unknown time zone (use an IANA name like Asia/Kolkata)");

//* One hall inside the create-venue request. sortOrder is not sent: the server uses the array position.
export const createHallSchema = z.object({
  name: z.string().trim().min(1, "Hall name is required").max(100),
  // The halls table has check (capacity > 0), so 0 is rejected here with a friendly message.
  capacity: z
    .number()
    .int("Capacity must be a whole number")
    .positive("Capacity must be above 0"),
});
// Also the body of POST /api/venues/{venueId}/halls (add one hall to an existing venue).
export type CreateHallBody = z.infer<typeof createHallSchema>;

/**
 * The DB has a unique index on (venue_id, lower(name)): a repeated name (ignoring case) is
 * reported as an issue on that hall's name, instead of becoming a database error. Shared by
 * the request body and the add-venue form.
 */
export function addDuplicateHallNameIssues(
  halls: readonly { name: string }[],
  ctx: z.RefinementCtx,
) {
  const seen = new Set<string>();
  halls.forEach((hall, index) => {
    const key = hall.name.trim().toLowerCase();
    if (key !== "" && seen.has(key)) {
      ctx.addIssue({
        code: "custom",
        path: ["halls", index, "name"],
        message: "Hall names must be unique within the venue",
      });
    }
    seen.add(key);
  });
}

//* POST /api/venues: an admin creates a venue together with its halls.
// No id, createdBy or isActive here: the server sets them, never the client.
export const createVenueBodySchema = z
  .object({
    name: z.string().trim().min(1, "Venue name is required").max(255),
    addressLine: z.string().trim().min(1, "Address is required").max(500),
    city: z.string().trim().min(1, "City is required").max(100),
    // The name of a row of GET /api/states (any case); the server finds its id and answers 404
    // for a name that is no state.
    state: z.string().trim().min(1, "Select a state").max(100),
    postalCode: z.string().trim().max(20).optional(),
    country: z
      .string()
      .trim()
      .toUpperCase()
      .regex(COUNTRY_REGEX, "Use a 2-letter country code")
      .default("IN"),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    timezone: timezoneSchema.default("Asia/Kolkata"),
    halls: z.array(createHallSchema).min(1, "Add at least one hall").max(50),
  })
  .superRefine((body, ctx) => {
    // A map pin needs both coordinates or neither.
    if ((body.latitude === undefined) !== (body.longitude === undefined)) {
      ctx.addIssue({
        code: "custom",
        path: ["latitude"],
        message: "Provide both latitude and longitude, or neither",
      });
    }

    // Catch a repeated hall name here as a 400 with the exact hall highlighted.
    addDuplicateHallNameIssues(body.halls, ctx);
  });

export type CreateVenueBody = z.infer<typeof createVenueBodySchema>;

export const createHallResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  capacity: z.number().int(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
});

export type CreateHallDto = z.infer<typeof createHallResponseSchema>;

export const venueResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  addressLine: z.string(),
  city: z.string(),
  state: z.string().nullable(),
  postalCode: z.string().nullable(),
  country: z.string(),
  timezone: z.string(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  isActive: z.boolean(),
});

export const createVenueResponseSchema = venueResponseSchema.extend({
  createdAt: z.iso.datetime(),
  halls: z.array(createHallResponseSchema),
});

export type CreateVenueDto = z.infer<typeof createVenueResponseSchema>;

//* Get Venue by the id

// A uuid, not just a string: a malformed id would otherwise reach Postgres and become a 500.
export const getVenueParam = z.object({
  venueId: z.uuid("Venue id must be a valid id"),
});

// Detail = the venue plus a short list of its halls. One hall's own detail is a separate route.
export const venueDetailResponseSchema = venueResponseSchema.extend({
  halls: z.array(createHallResponseSchema),
});

export type VenueDetailDto = z.infer<typeof venueDetailResponseSchema>;

//* PATCH /api/venues/[venueId]: an admin edits the venue's details (not its halls or status).
// Every field is optional: only the ones sent are changed. For the map pin, `null` clears a
// coordinate and a missing field leaves it as it is; both must end up set or both empty.
export const updateVenueBodySchema = z
  .object({
    name: createVenueBodySchema.shape.name,
    addressLine: createVenueBodySchema.shape.addressLine,
    city: createVenueBodySchema.shape.city,
    state: createVenueBodySchema.shape.state,
    // null = clear the postal code.
    postalCode: z.string().trim().max(20).nullable(),
    country: z
      .string()
      .trim()
      .toUpperCase()
      .regex(COUNTRY_REGEX, "Use a 2-letter country code"),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    timezone: timezoneSchema,
  })
  .partial()
  .superRefine((body, ctx) => {
    if (Object.keys(body).length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Send at least one field to change",
      });
    }
    // Sending only one coordinate is ambiguous (the other one may already be stored).
    if ((body.latitude === undefined) !== (body.longitude === undefined)) {
      ctx.addIssue({
        code: "custom",
        path: [body.latitude === undefined ? "latitude" : "longitude"],
        message: "Send latitude and longitude together",
      });
    }
    // One coordinate cleared and the other set would leave half a pin.
    if ((body.latitude === null) !== (body.longitude === null)) {
      ctx.addIssue({
        code: "custom",
        path: ["latitude"],
        message: "Provide both latitude and longitude, or neither",
      });
    }
  });

export type UpdateVenueBody = z.infer<typeof updateVenueBodySchema>;

//* PATCH /api/venues/[venueId]/halls/[hallId]: rename a hall or change its seats.
export const updateHallBodySchema = createHallSchema
  .partial()
  .refine(
    (body) => body.name !== undefined || body.capacity !== undefined,
    "Send a name or a capacity",
  );

export type UpdateHallBody = z.infer<typeof updateHallBodySchema>;

//* PATCH /api/venues/[venueId]/status: activate or deactivate a venue.
// Deactivating always deactivates all its halls. Activating activates none of them unless
// `activateHalls` is "all" (the default "none": an admin then activates the halls one by one).
export const setVenueStatusBodySchema = z.object({
  isActive: z.boolean(),
  activateHalls: z.enum(["all", "none"]).default("none"),
});

export type SetVenueStatusBody = z.infer<typeof setVenueStatusBodySchema>;

//* PATCH /api/venues/[venueId]/halls/status: turn halls on or off.
// `halls` is "all" (every hall of the venue) or a list of hall ids (one id = a single hall).
export const setHallsStatusBodySchema = z.object({
  isActive: z.boolean(),
  halls: z.union([
    z.literal("all"),
    z
      .array(z.uuid("Each hall id must be a valid id"))
      .min(1, "Pick at least one hall")
      .max(50)
      .refine(
        (ids) => new Set(ids).size === ids.length,
        "Hall ids must be unique",
      ),
  ]),
});

export type SetHallsStatusBody = z.infer<typeof setHallsStatusBodySchema>;

//* GET /api/venues/[venueId]/halls/[hallId]: one hall with a short summary of its venue.
export const getHallParam = z.object({
  venueId: z.uuid("Venue id must be a valid id"),
  hallId: z.uuid("Hall id must be a valid id"),
});

export const hallDetailResponseSchema = createHallResponseSchema.extend({
  createdAt: z.iso.datetime(),
  venue: z.object({
    id: z.uuid(),
    name: z.string(),
    city: z.string(),
    isActive: z.boolean(),
  }),
});

export type HallDetailDto = z.infer<typeof hallDetailResponseSchema>;

//* GET /api/venues: the list of venues (search, status filter, sort, paging).
export const venueStatusFilters = ["active", "inactive"] as const;
export type VenueStatusFilter = (typeof venueStatusFilters)[number];

export const venueSorts = ["name", "newest", "halls"] as const;
export type VenueSort = (typeof venueSorts)[number];

export const venueListItemSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  addressLine: z.string(),
  city: z.string(),
  state: z.string().nullable(),
  country: z.string(),
  timezone: z.string(),
  isActive: z.boolean(),
  // Counted by the server, so the table does not need every venue's halls.
  hallCount: z.number().int().min(0),
  hallsOn: z.number().int().min(0),
  totalSeats: z.number().int().min(0),
});

export const venueListResponseSchema = z.array(venueListItemSchema);

export type VenueListItemDto = z.infer<typeof venueListItemSchema>;

// Every filter is optional: without them the list is not filtered. Missing keys arrive as
// undefined (parseQuery reads the URL into an object), so .optional() is enough.
export const venueListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  /** Matches the venue name or the city (contains, ignoring case). */
  search: z.string().trim().max(100).optional(),
  /** Only active or only inactive venues. Guests always get active ones, whatever they ask. */
  status: z.enum(venueStatusFilters).optional(),
  /** Only venues in the state with this name (ignoring case). An unknown name matches nothing. */
  state: z.string().trim().max(100).optional(),
  sort: z.enum(venueSorts).default("name"),
});

export type VenueListQuery = z.infer<typeof venueListQuerySchema>;
