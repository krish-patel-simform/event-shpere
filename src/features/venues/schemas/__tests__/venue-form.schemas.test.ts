import {
  createVenueFormSchema,
  emptyVenueForm,
  hallFormSchema,
  toCreateVenueBody,
  toCreateHallBody,
  type CreateVenueFormValues,
} from "../venue-form.schemas";

const valid: CreateVenueFormValues = {
  name: "GIFT City Convention Centre",
  addressLine: "Block 12, Zone 1, GIFT City",
  city: "Gandhinagar",
  state: "Gujarat",
  postalCode: "382355",
  country: "IN",
  timezone: "Asia/Kolkata",
  latitude: "23.16",
  longitude: "72.68",
  halls: [
    { name: "Main Auditorium", capacity: "300" },
    { name: "Workshop Room 1", capacity: "80" },
  ],
};

/** The first message for one field, as the form would show it. */
function messageAt(
  values: CreateVenueFormValues,
  ...path: (string | number)[]
) {
  const result = createVenueFormSchema.safeParse(values);
  if (result.success) return undefined;
  return result.error.issues.find(
    (issue) => issue.path.join(".") === path.join("."),
  )?.message;
}

describe("createVenueFormSchema", () => {
  it("accepts a complete form", () => {
    expect(createVenueFormSchema.safeParse(valid).success).toBe(true);
  });

  it("does not accept the empty form the page starts with", () => {
    expect(createVenueFormSchema.safeParse(emptyVenueForm).success).toBe(false);
  });

  it("asks for the required venue fields", () => {
    const blank = { ...valid, name: " ", addressLine: "", city: "" };
    expect(messageAt(blank, "name")).toBe("Venue name is required");
    expect(messageAt(blank, "addressLine")).toBe("Address is required");
    expect(messageAt(blank, "city")).toBe("City is required");
  });

  it("accepts a lower-case country code and refuses a long one", () => {
    expect(messageAt({ ...valid, country: "in" }, "country")).toBeUndefined();
    expect(messageAt({ ...valid, country: "IND" }, "country")).toMatch(
      /2-letter/,
    );
  });

  it("refuses an unknown time zone", () => {
    expect(
      messageAt({ ...valid, timezone: "Mars/Olympus" }, "timezone"),
    ).toMatch(/Unknown time zone/);
  });

  it("lets the map pin stay empty, but not half filled", () => {
    const none = { ...valid, latitude: "", longitude: "" };
    expect(createVenueFormSchema.safeParse(none).success).toBe(true);

    expect(messageAt({ ...valid, longitude: "" }, "longitude")).toMatch(
      /both latitude and longitude/,
    );
    expect(messageAt({ ...valid, latitude: "" }, "latitude")).toMatch(
      /both latitude and longitude/,
    );
  });

  it("checks coordinates are numbers inside their limits", () => {
    expect(messageAt({ ...valid, latitude: "north" }, "latitude")).toMatch(
      /Latitude must be a number/,
    );
    expect(messageAt({ ...valid, latitude: "91" }, "latitude")).toMatch(
      /-90 to 90/,
    );
    expect(messageAt({ ...valid, longitude: "-181" }, "longitude")).toMatch(
      /-180 to 180/,
    );
  });

  it("needs at least one hall, with a name and seats above 0", () => {
    expect(messageAt({ ...valid, halls: [] }, "halls")).toBe(
      "Add at least one hall",
    );
    const bad = {
      ...valid,
      halls: [
        { name: "", capacity: "" },
        { name: "B", capacity: "0" },
        { name: "C", capacity: "12.5" },
      ],
    };
    expect(messageAt(bad, "halls", 0, "name")).toBe("Hall name is required");
    expect(messageAt(bad, "halls", 0, "capacity")).toBe("Seats are required");
    expect(messageAt(bad, "halls", 1, "capacity")).toBe(
      "Seats must be above 0",
    );
    expect(messageAt(bad, "halls", 2, "capacity")).toBe(
      "Seats must be a whole number",
    );
  });

  it("points at the second hall when two halls share a name, ignoring case", () => {
    const repeated = {
      ...valid,
      halls: [
        { name: "Workshop Room 1", capacity: "80" },
        { name: "workshop room 1", capacity: "80" },
      ],
    };
    expect(messageAt(repeated, "halls", 1, "name")).toBe(
      "Hall names must be unique within the venue",
    );
    expect(messageAt(repeated, "halls", 0, "name")).toBeUndefined();
  });
});

describe("toCreateVenueBody", () => {
  it("turns text into the API body: numbers are numbers, the country is upper case", () => {
    const body = toCreateVenueBody({ ...valid, country: "in" });

    expect(body).toEqual({
      name: "GIFT City Convention Centre",
      addressLine: "Block 12, Zone 1, GIFT City",
      city: "Gandhinagar",
      state: "Gujarat",
      postalCode: "382355",
      country: "IN",
      timezone: "Asia/Kolkata",
      latitude: 23.16,
      longitude: 72.68,
      halls: [
        { name: "Main Auditorium", capacity: 300 },
        { name: "Workshop Room 1", capacity: 80 },
      ],
    });
  });

  it("leaves blank optional fields out of the body", () => {
    const body = toCreateVenueBody({
      ...valid,
      state: "",
      postalCode: "",
      latitude: "",
      longitude: "",
    });

    // undefined is dropped when the body is sent as JSON.
    expect(body.state).toBeUndefined();
    expect(body.postalCode).toBeUndefined();
    expect(body.latitude).toBeUndefined();
    expect(body.longitude).toBeUndefined();
  });
});

describe("hall form (the Add hall dialog)", () => {
  it("validates one hall row and builds the body", () => {
    const values = hallFormSchema.parse({ name: " Hall C ", capacity: "120" });

    expect(toCreateHallBody(values)).toEqual({ name: "Hall C", capacity: 120 });
    expect(hallFormSchema.safeParse({ name: "", capacity: "" }).success).toBe(
      false,
    );
  });
});
