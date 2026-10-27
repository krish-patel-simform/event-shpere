import {
  apiRequest,
  apiRequestPage,
} from "../../../../core/api-client/base-api.service";
import {
  createSpeakerResponseSchema,
  getSpeakersResponseSchema,
  speakerProfileResponseSchema,
} from "../../schemas/speaker.schemas";
import { speakersApiService } from "../speakers-api.service";

jest.mock("../../../../core/api-client/base-api.service", () => ({
  apiRequest: jest.fn(),
  apiRequestPage: jest.fn(),
}));

beforeEach(() => jest.clearAllMocks());

describe("speakersApiService.list", () => {
  it("asks for one page, parsed with the list schema", () => {
    speakersApiService.list({ pageSize: 12 });

    expect(apiRequestPage).toHaveBeenCalledWith(
      {
        method: "GET",
        url: "/speakers",
        params: { page: 1, pageSize: 12 },
      },
      getSpeakersResponseSchema,
    );
  });

  it("sends the search and the page when they are set", () => {
    speakersApiService.list({ search: "ananya", page: 3, pageSize: 12 });

    const [config] = jest.mocked(apiRequestPage).mock.calls[0];
    expect(config.params).toEqual({ page: 3, pageSize: 12, search: "ananya" });
  });

  it("leaves an empty search out, so the server does not filter", () => {
    speakersApiService.list({ search: "", pageSize: 12 });

    const [config] = jest.mocked(apiRequestPage).mock.calls[0];
    expect(config.params).not.toHaveProperty("search");
  });
});

describe("speakersApiService.get", () => {
  it("reads one speaker from its slug and parses the answer", () => {
    speakersApiService.get("ananya-rao-3f9a1c");

    expect(apiRequest).toHaveBeenCalledWith(
      { method: "GET", url: "/speakers/ananya-rao-3f9a1c" },
      speakerProfileResponseSchema,
    );
  });
});

describe("speakersApiService.create", () => {
  it("posts the body to the speakers URL and parses the answer", () => {
    const body = {
      firstName: "Sneha",
      lastName: "Desai",
      email: "sneha.desai@example.com",
    };

    speakersApiService.create(body);

    expect(apiRequest).toHaveBeenCalledWith(
      { method: "POST", url: "/speakers", data: body },
      createSpeakerResponseSchema,
    );
  });
});
