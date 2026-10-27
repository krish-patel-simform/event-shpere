import {
  apiRequest,
  apiRequestPage,
} from "../../../../core/api-client/base-api.service";
import {
  createOrganizerResponseSchema,
  getOrganizersResponseSchema,
  organizerDetailResponseSchema,
  verifyOrganizerResponseSchema,
} from "../../schemas/organizer.schemas";
import { organizerApiService } from "../organizer-api.service";

jest.mock("../../../../core/api-client/base-api.service", () => ({
  apiRequest: jest.fn(),
  apiRequestPage: jest.fn(),
}));

const id = "0b7c2d1e-3f4a-4b5c-8d6e-7f8091a2b3c4";

beforeEach(() => jest.clearAllMocks());

describe("organizerApiService.list", () => {
  it("asks for one list with its paging, parsed with the list schema", () => {
    organizerApiService.list({ verification: "pending", pageSize: 50 });

    expect(apiRequestPage).toHaveBeenCalledWith(
      {
        method: "GET",
        url: "/admin/organizers",
        params: { verification: "pending", page: 1, pageSize: 50 },
      },
      getOrganizersResponseSchema,
    );
  });

  it("sends every filter that is set", () => {
    organizerApiService.list({
      verification: "pending",
      search: "harbor",
      emailVerified: false,
      sort: "oldest",
      page: 3,
      pageSize: 10,
    });

    expect(apiRequestPage).toHaveBeenCalledWith(
      expect.objectContaining({
        params: {
          verification: "pending",
          page: 3,
          pageSize: 10,
          search: "harbor",
          emailVerified: false,
          sort: "oldest",
        },
      }),
      getOrganizersResponseSchema,
    );
  });

  it("with no verification asks for every organizer: the parameter is not sent at all", () => {
    organizerApiService.list({ pageSize: 10 });

    const [config] = jest.mocked(apiRequestPage).mock.calls[0];
    expect(config.params).toEqual({ page: 1, pageSize: 10 });
  });

  it("sends emailVerified: true as well as false (only 'not set' is left out)", () => {
    organizerApiService.list({
      verification: "pending",
      emailVerified: true,
      pageSize: 10,
    });

    const [config] = jest.mocked(apiRequestPage).mock.calls[0];
    expect(config.params).toHaveProperty("emailVerified", true);
  });

  it("leaves out a filter that is not set, so the server does not filter by it", () => {
    organizerApiService.list({
      verification: "rejected",
      search: "",
      emailVerified: undefined,
      pageSize: 50,
    });

    const [config] = jest.mocked(apiRequestPage).mock.calls[0];
    expect(config.params).not.toHaveProperty("search");
    expect(config.params).not.toHaveProperty("emailVerified");
    expect(config.params).not.toHaveProperty("sort");
  });
});

describe("organizerApiService.get", () => {
  it("reads one application from its URL and parses the answer", () => {
    organizerApiService.get(id);

    expect(apiRequest).toHaveBeenCalledWith(
      { method: "GET", url: `/admin/organizers/${id}` },
      organizerDetailResponseSchema,
    );
  });
});

describe("organizerApiService.create", () => {
  it("posts the body to the organizers URL and parses the answer", () => {
    const body = {
      firstName: "Ananya",
      lastName: "Rao",
      email: "ananya.rao@example.com",
      organizationName: "Acme Events Pvt Ltd",
    };

    organizerApiService.create(body);

    expect(apiRequest).toHaveBeenCalledWith(
      { method: "POST", url: "/admin/organizers", data: body },
      createOrganizerResponseSchema,
    );
  });
});

describe("organizerApiService decisions", () => {
  it("verify posts to the organizer's verify URL and parses the answer", () => {
    organizerApiService.verify(id);

    expect(apiRequest).toHaveBeenCalledWith(
      { method: "POST", url: `/admin/organizers/${id}/verify` },
      verifyOrganizerResponseSchema,
    );
  });

  it("reject posts the reason as the body", () => {
    organizerApiService.reject(id, { reason: "Website could not be verified" });

    expect(apiRequest).toHaveBeenCalledWith(
      {
        method: "POST",
        url: `/admin/organizers/${id}/reject`,
        data: { reason: "Website could not be verified" },
      },
      expect.anything(),
    );
  });

  it("reopen posts to the organizer's reopen URL, with no body", () => {
    organizerApiService.reopen(id);

    expect(apiRequest).toHaveBeenCalledWith(
      { method: "POST", url: `/admin/organizers/${id}/reopen` },
      expect.anything(),
    );
  });
});
