import { z } from "zod";
import { COUNTRY_REGEX } from "../constants";
import {
  addDuplicateHallNameIssues,
  createHallSchema,
  createVenueBodySchema,
  timezoneSchema,
  updateHallBodySchema,
  updateVenueBodySchema,
  type CreateHallBody,
  type CreateVenueBody,
  type UpdateHallBody,
  type UpdateVenueBody,
  type VenueDetailDto,
} from "./venue.schemas";

// The form keeps every input as text (an empty number box is "", not NaN). These rules give the
// same answers as createVenueBodySchema, with messages written for the person filling the form;
// toCreateVenueBody then builds the real body and the server schema checks it once more.

const seatsField = z
  .string()
  .trim()
  .min(1, "Seats are required")
  .regex(/^\d+$/, "Seats must be a whole number")
  .refine((value) => Number(value) > 0, "Seats must be above 0");

/** One hall row: used inside the add-venue form and alone by the Add hall dialog. */
export const hallFormSchema = z.object({
  name: z.string().trim().min(1, "Hall name is required").max(100),
  capacity: seatsField,
});

export type HallFormValues = z.infer<typeof hallFormSchema>;

/** The validated hall row as the body POST /api/venues/{id}/halls takes. */
export function toCreateHallBody(values: HallFormValues): CreateHallBody {
  return createHallSchema.parse({
    name: values.name,
    capacity: Number(values.capacity),
  });
}

/** Empty is fine (the map pin is optional); anything else must be a number inside the limit. */
const coordinateField = (label: string, limit: number) =>
  z
    .string()
    .trim()
    .refine(
      (value) =>
        value === "" ||
        (Number.isFinite(Number(value)) && Math.abs(Number(value)) <= limit),
      `${label} must be a number from -${limit} to ${limit}`,
    );

// The venue's own fields: shared by the add-venue form and the edit-venue form.
const venueDetailsFields = {
  name: z.string().trim().min(1, "Venue name is required").max(255),
  addressLine: z.string().trim().min(1, "Address is required").max(500),
  city: z.string().trim().min(1, "City is required").max(100),
  // The name of the chosen state: the server turns it into the state's id.
  state: z.string().trim().min(1, "Select a state").max(100),
  postalCode: z.string().trim().max(20),
  country: z
    .string()
    .trim()
    .refine(
      (value) => COUNTRY_REGEX.test(value.toUpperCase()),
      "Use a 2-letter country code, like IN",
    ),
  timezone: timezoneSchema,
  latitude: coordinateField("Latitude", 90),
  longitude: coordinateField("Longitude", 180),
};

/** A map pin needs both coordinates or neither: point at the empty one. */
function addMapPinIssues(
  values: { latitude: string; longitude: string },
  ctx: z.RefinementCtx,
) {
  const hasLatitude = values.latitude !== "";
  const hasLongitude = values.longitude !== "";
  if (hasLatitude !== hasLongitude) {
    ctx.addIssue({
      code: "custom",
      path: [hasLatitude ? "longitude" : "latitude"],
      message: "Fill in both latitude and longitude, or leave both empty",
    });
  }
}

export const createVenueFormSchema = z
  .object({
    ...venueDetailsFields,
    halls: z.array(hallFormSchema).min(1, "Add at least one hall").max(50),
  })
  .superRefine((values, ctx) => {
    addMapPinIssues(values, ctx);
    addDuplicateHallNameIssues(values.halls, ctx);
  });

export type CreateVenueFormValues = z.infer<typeof createVenueFormSchema>;

/** The edit-venue form: the same fields, without the halls (they have their own dialogs). */
export const editVenueFormSchema = z
  .object(venueDetailsFields)
  .superRefine(addMapPinIssues);

export type VenueDetailsFormValues = z.infer<typeof editVenueFormSchema>;

/** The edit form starts with what the venue has now. A missing postal code or pin is "". */
export function toVenueFormValues(
  venue: VenueDetailDto,
): VenueDetailsFormValues {
  return {
    name: venue.name,
    addressLine: venue.addressLine,
    city: venue.city,
    state: venue.state ?? "",
    postalCode: venue.postalCode ?? "",
    country: venue.country,
    timezone: venue.timezone,
    latitude: venue.latitude === null ? "" : String(venue.latitude),
    longitude: venue.longitude === null ? "" : String(venue.longitude),
  };
}

/**
 * The body of PATCH /api/venues/{id}: only the fields whose value differs from what the venue
 * has now (`venue`). An empty object = nothing changed, so there is nothing to send. Country and
 * time zone are fixed in the form and never sent. The map pin goes as a pair: both set, or both
 * cleared (null).
 */
export function toUpdateVenueBody(
  values: VenueDetailsFormValues,
  venue: VenueDetailDto,
): UpdateVenueBody {
  const body: Record<string, unknown> = {};
  if (values.name !== venue.name) body.name = values.name;
  if (values.addressLine !== venue.addressLine)
    body.addressLine = values.addressLine;
  if (values.city !== venue.city) body.city = values.city;
  if (values.state !== (venue.state ?? "")) body.state = values.state;
  if (values.postalCode !== (venue.postalCode ?? ""))
    body.postalCode = blankToNull(values.postalCode);

  const latitude = blankToNull(values.latitude);
  const longitude = blankToNull(values.longitude);
  const pinChanged =
    (latitude === null ? null : Number(latitude)) !== venue.latitude ||
    (longitude === null ? null : Number(longitude)) !== venue.longitude;
  if (pinChanged) {
    body.latitude = latitude === null ? null : Number(latitude);
    body.longitude = longitude === null ? null : Number(longitude);
  }

  // Not an empty-body check: the server schema refuses {} on purpose, so the caller skips the
  // request when nothing changed. Everything else is validated by the server schema here too.
  return Object.keys(body).length === 0
    ? {}
    : updateVenueBodySchema.parse(body);
}

/** The body of PATCH /api/venues/{id}/halls/{hallId}: only the name and/or seats that changed. */
export function toUpdateHallBody(
  values: HallFormValues,
  hall: { name: string; capacity: number },
): UpdateHallBody {
  const body: Record<string, unknown> = {};
  if (values.name !== hall.name) body.name = values.name;
  if (Number(values.capacity) !== hall.capacity)
    body.capacity = Number(values.capacity);
  return Object.keys(body).length === 0 ? {} : updateHallBodySchema.parse(body);
}

/** What the form starts with: India and its time zone are the usual case, one empty hall row. */
export const emptyVenueForm: CreateVenueFormValues = {
  name: "",
  addressLine: "",
  city: "",
  state: "",
  postalCode: "",
  country: "IN",
  timezone: "Asia/Kolkata",
  latitude: "",
  longitude: "",
  halls: [{ name: "", capacity: "" }],
};

const blankToUndefined = (value: string) => (value === "" ? undefined : value);
const blankToNull = (value: string) => (value === "" ? null : value);

/** The validated form as the body POST /api/venues takes: numbers are numbers, blanks are left out. */
export function toCreateVenueBody(
  values: CreateVenueFormValues,
): CreateVenueBody {
  return createVenueBodySchema.parse({
    name: values.name,
    addressLine: values.addressLine,
    city: values.city,
    state: values.state,
    postalCode: blankToUndefined(values.postalCode),
    country: values.country,
    timezone: values.timezone,
    latitude: values.latitude === "" ? undefined : Number(values.latitude),
    longitude: values.longitude === "" ? undefined : Number(values.longitude),
    halls: values.halls.map((hall) => ({
      name: hall.name,
      capacity: Number(hall.capacity),
    })),
  });
}
