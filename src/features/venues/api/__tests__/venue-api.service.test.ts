import {
  apiRequest,
  apiRequestPage,
} from "../../../../core/api-client/base-api.service";
import { hallAvailabilityResponseSchema } from "../../schemas/hall-availability.schemas";
import {
  createVenueResponseSchema,
  venueDetailResponseSchema,
  venueListResponseSchema,
} from "../../schemas/venue.schemas";
import { giftCity, hallIds, venueId } from "../../__fixtures__/venues";
import { venueApiService } from "../venue-api.service";

jest.mock("../../../../core/api-client/base-api.service", () => ({
  apiRequest: jest.fn(),
  apiRequestPage: jest.fn(),
}));

beforeEach(() => jest.clearAllMocks());

describe("venueApiService", () => {
  it("getHallAvailability asks for the halls' free times of a range and parses the answer", () => {
    const range = {
      startAt: "2026-12-12T09:00:00+05:30",
      endAt: "2026-12-12T17:00:00+05:30",
    };

    venueApiService.getHallAvailability(venueId, range);

    expect(apiRequest).toHaveBeenCalledWith(
      {
        method: "GET",
        url: `/venues/${venueId}/halls/availability`,
        params: range,
      },
      hallAvailabilityResponseSchema,
    );
  });

  it("getHallAvailability also sends the session being edited, so its own booking is left out", () => {
    const range = {
      startAt: "2026-12-12T09:00:00+05:30",
      endAt: "2026-12-12T17:00:00+05:30",
      exceptSessionId: "7c3d4e5f-6a7b-4c8d-ae9f-1a2b3c4d5e01",
    };

    venueApiService.getHallAvailability(venueId, range);

    expect(apiRequest).toHaveBeenCalledWith(
      {
        method: "GET",
        url: `/venues/${venueId}/halls/availability`,
        params: range,
      },
      hallAvailabilityResponseSchema,
    );
  });

  it("get reads one venue and parses the detail schema", () => {
    venueApiService.get(venueId);

    expect(apiRequest).toHaveBeenCalledWith(
      { method: "GET", url: `/venues/${venueId}` },
      venueDetailResponseSchema,
    );
  });

  it("setStatus patches the venue status with the body", () => {
    venueApiService.setStatus(venueId, {
      isActive: true,
      activateHalls: "all",
    });

    expect(apiRequest).toHaveBeenCalledWith(
      {
        method: "PATCH",
        url: `/venues/${venueId}/status`,
        data: { isActive: true, activateHalls: "all" },
      },
      venueDetailResponseSchema,
    );
  });

  it("setHallsStatus patches the halls status with the ids", () => {
    venueApiService.setHallsStatus(venueId, {
      isActive: false,
      halls: [hallIds.main],
    });

    expect(apiRequest).toHaveBeenCalledWith(
      {
        method: "PATCH",
        url: `/venues/${venueId}/halls/status`,
        data: { isActive: false, halls: [hallIds.main] },
      },
      venueDetailResponseSchema,
    );
  });

  it("addHall posts the hall to the venue's halls", () => {
    venueApiService.addHall(venueId, { name: "Hall C", capacity: 120 });

    expect(apiRequest).toHaveBeenCalledWith(
      {
        method: "POST",
        url: `/venues/${venueId}/halls`,
        data: { name: "Hall C", capacity: 120 },
      },
      venueDetailResponseSchema,
    );
  });

  it("deleteHall deletes one hall of the venue", () => {
    venueApiService.deleteHall(venueId, hallIds.lounge);

    expect(apiRequest).toHaveBeenCalledWith(
      { method: "DELETE", url: `/venues/${venueId}/halls/${hallIds.lounge}` },
      venueDetailResponseSchema,
    );
  });

  it("list asks for one page, parsed with the list schema", () => {
    venueApiService.list({ pageSize: 10 });

    expect(apiRequestPage).toHaveBeenCalledWith(
      { method: "GET", url: "/venues", params: { page: 1, pageSize: 10 } },
      venueListResponseSchema,
    );
  });

  it("list sends every filter that is set", () => {
    venueApiService.list({
      status: "inactive",
      search: "pune",
      state: "Maharashtra",
      sort: "halls",
      page: 3,
      pageSize: 25,
    });

    expect(apiRequestPage).toHaveBeenCalledWith(
      {
        method: "GET",
        url: "/venues",
        params: {
          page: 3,
          pageSize: 25,
          status: "inactive",
          search: "pune",
          state: "Maharashtra",
          sort: "halls",
        },
      },
      venueListResponseSchema,
    );
  });

  it("list leaves out a blank search and an unset status, so the server does not filter by them", () => {
    venueApiService.list({ search: "", state: "", pageSize: 10 });

    const [config] = jest.mocked(apiRequestPage).mock.calls[0];
    expect(config.params).toEqual({ page: 1, pageSize: 10 });
  });

  it("the detail schema accepts the venue the screen tests use", () => {
    expect(venueDetailResponseSchema.parse(giftCity)).toEqual(giftCity);
  });

  it("the detail schema refuses a venue whose halls are not a list", () => {
    expect(
      venueDetailResponseSchema.safeParse({ ...giftCity, halls: "none" })
        .success,
    ).toBe(false);
  });

  it("create posts the venue with its halls and parses the created venue", () => {
    const body = {
      name: "GIFT City Convention Centre",
      addressLine: "Block 12, Zone 1, GIFT City",
      city: "Gandhinagar",
      state: "Gujarat",
      country: "IN",
      timezone: "Asia/Kolkata",
      halls: [{ name: "Main Auditorium", capacity: 300 }],
    };

    venueApiService.create(body);

    expect(apiRequest).toHaveBeenCalledWith(
      { method: "POST", url: "/venues", data: body },
      createVenueResponseSchema,
    );
  });

  it("the create schema refuses an answer without the venue's creation time", () => {
    // giftCity is a detail answer: it has no createdAt.
    expect(createVenueResponseSchema.safeParse(giftCity).success).toBe(false);
    expect(
      createVenueResponseSchema.safeParse({
        ...giftCity,
        createdAt: "2026-11-01T10:00:00.000Z",
      }).success,
    ).toBe(true);
  });

  it("update patches only the fields it is given", () => {
    venueApiService.update(venueId, { city: "Surat", postalCode: null });

    expect(apiRequest).toHaveBeenCalledWith(
      {
        method: "PATCH",
        url: `/venues/${venueId}`,
        data: { city: "Surat", postalCode: null },
      },
      venueDetailResponseSchema,
    );
  });

  it("delete deletes the venue and expects no body back (204)", () => {
    venueApiService.delete(venueId);

    expect(apiRequest).toHaveBeenCalledWith({
      method: "DELETE",
      url: `/venues/${venueId}`,
    });
    // No schema: a 204 has nothing to parse.
    expect(jest.mocked(apiRequest).mock.calls[0]).toHaveLength(1);
  });

  it("updateHall patches one hall of the venue with what changed", () => {
    venueApiService.updateHall(venueId, hallIds.workshop, { capacity: 90 });

    expect(apiRequest).toHaveBeenCalledWith(
      {
        method: "PATCH",
        url: `/venues/${venueId}/halls/${hallIds.workshop}`,
        data: { capacity: 90 },
      },
      venueDetailResponseSchema,
    );
  });

  it("passes on the API's failure to the caller", async () => {
    const failure = new Error("This venue was used by an event");
    jest.mocked(apiRequest).mockRejectedValueOnce(failure);

    await expect(venueApiService.delete(venueId)).rejects.toBe(failure);
  });
});
