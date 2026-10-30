import {
  apiRequest,
  apiRequestPage,
} from "../../../../core/api-client/base-api.service";
import {
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
          sort: "halls",
        },
      },
      venueListResponseSchema,
    );
  });

  it("list leaves out a blank search and an unset status, so the server does not filter by them", () => {
    venueApiService.list({ search: "", pageSize: 10 });

    const [config] = jest.mocked(apiRequestPage).mock.calls[0];
    expect(config.params).toEqual({ page: 1, pageSize: 10 });
  });

  it("the detail schema accepts the venue the screen tests use", () => {
    expect(venueDetailResponseSchema.parse(giftCity)).toEqual(giftCity);
  });
});
