import {
  apiRequest,
  apiRequestPage,
} from "../../../../core/api-client/base-api.service";
import {
  resendInviteResponseSchema,
  sendResetLinkResponseSchema,
} from "../../../auth";
import {
  getUsersResponseSchema,
  userDetailResponseSchema,
  userStatusResponseSchema,
} from "../../schemas/users.schema";
import { usersApiService } from "../users-api.service";

jest.mock("../../../../core/api-client/base-api.service", () => ({
  apiRequest: jest.fn(),
  apiRequestPage: jest.fn(),
}));

const id = "0b7c2d1e-3f4a-4b5c-8d6e-7f8091a2b3c4";

beforeEach(() => jest.clearAllMocks());

describe("usersApiService.list", () => {
  it("with no filters sends only paging and the default sort", () => {
    usersApiService.list({ pageSize: 10 });

    expect(apiRequestPage).toHaveBeenCalledWith(
      {
        method: "GET",
        url: "/admin/users",
        params: { page: 1, pageSize: 10, sort: "newest" },
      },
      getUsersResponseSchema,
    );
  });

  it("sends every filter that is set", () => {
    usersApiService.list({
      role: "speaker",
      status: "suspended",
      search: "meera",
      sort: "name",
      page: 3,
      pageSize: 8,
    });

    expect(apiRequestPage).toHaveBeenCalledWith(
      expect.objectContaining({
        params: {
          page: 3,
          pageSize: 8,
          sort: "name",
          role: "speaker",
          status: "suspended",
          search: "meera",
        },
      }),
      getUsersResponseSchema,
    );
  });

  it("leaves out a filter that is not set, so the server does not filter by it", () => {
    usersApiService.list({
      pageSize: 10,
      role: undefined,
      status: undefined,
      search: "",
    });

    const [config] = jest.mocked(apiRequestPage).mock.calls[0];
    expect(config.params).not.toHaveProperty("role");
    expect(config.params).not.toHaveProperty("status");
    expect(config.params).not.toHaveProperty("search");
  });
});

describe("usersApiService.resendInvite", () => {
  it("posts to the user's resend-invite URL with no body, and parses the answer", () => {
    usersApiService.resendInvite(id);

    expect(apiRequest).toHaveBeenCalledWith(
      { method: "POST", url: `/admin/users/${id}/resend-invite` },
      resendInviteResponseSchema,
    );
  });
});

describe("usersApiService status changes", () => {
  it("suspend posts to the user's suspend URL with no body, and parses the answer", () => {
    usersApiService.suspend(id);

    expect(apiRequest).toHaveBeenCalledWith(
      { method: "POST", url: `/admin/users/${id}/suspend` },
      userStatusResponseSchema,
    );
  });

  it("reactivate posts to the user's reactivate URL with no body", () => {
    usersApiService.reactivate(id);

    expect(apiRequest).toHaveBeenCalledWith(
      { method: "POST", url: `/admin/users/${id}/reactivate` },
      userStatusResponseSchema,
    );
  });
});

describe("usersApiService.get", () => {
  it("reads one user by id and parses the detail answer", () => {
    usersApiService.get(id);

    expect(apiRequest).toHaveBeenCalledWith(
      { method: "GET", url: `/admin/users/${id}` },
      userDetailResponseSchema,
    );
  });

  it("passes on the API's failure (e.g. 404) to the caller", async () => {
    const failure = new Error("User not found");
    jest.mocked(apiRequest).mockRejectedValueOnce(failure);

    await expect(usersApiService.get(id)).rejects.toBe(failure);
  });
});

describe("usersApiService.sendResetLink", () => {
  it("posts to the user's send-reset-link URL with no body, and parses the answer", () => {
    usersApiService.sendResetLink(id);

    expect(apiRequest).toHaveBeenCalledWith(
      { method: "POST", url: `/admin/users/${id}/send-reset-link` },
      sendResetLinkResponseSchema,
    );
  });

  it("its answer schema accepts only the expiry, never the link itself", () => {
    const expiresAt = "2026-11-22T10:00:00.000Z";

    expect(
      sendResetLinkResponseSchema.parse({
        expiresAt,
        link: "https://example.test/reset#token=secret",
      }),
    ).toEqual({ expiresAt });
    expect(sendResetLinkResponseSchema.safeParse({}).success).toBe(false);
  });
});
