import { z } from "zod";
import { COUNTRY_REGEX } from "../constants";
import {
  addDuplicateHallNameIssues,
  createHallSchema,
  createVenueBodySchema,
  timezoneSchema,
  type CreateHallBody,
  type CreateVenueBody,
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

export const createVenueFormSchema = z
  .object({
    name: z.string().trim().min(1, "Venue name is required").max(255),
    addressLine: z.string().trim().min(1, "Address is required").max(500),
    city: z.string().trim().min(1, "City is required").max(100),
    state: z.string().trim().max(100),
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
    halls: z.array(hallFormSchema).min(1, "Add at least one hall").max(50),
  })
  .superRefine((values, ctx) => {
    // A map pin needs both coordinates or neither: point at the empty one.
    const hasLatitude = values.latitude !== "";
    const hasLongitude = values.longitude !== "";
    if (hasLatitude !== hasLongitude) {
      ctx.addIssue({
        code: "custom",
        path: [hasLatitude ? "longitude" : "latitude"],
        message: "Fill in both latitude and longitude, or leave both empty",
      });
    }
    addDuplicateHallNameIssues(values.halls, ctx);
  });

export type CreateVenueFormValues = z.infer<typeof createVenueFormSchema>;

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

/** The validated form as the body POST /api/venues takes: numbers are numbers, blanks are left out. */
export function toCreateVenueBody(
  values: CreateVenueFormValues,
): CreateVenueBody {
  return createVenueBodySchema.parse({
    name: values.name,
    addressLine: values.addressLine,
    city: values.city,
    state: blankToUndefined(values.state),
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
