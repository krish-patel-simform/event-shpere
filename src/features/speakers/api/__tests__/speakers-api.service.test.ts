import {
  apiRequest,
  apiRequestPage,
} from "../../../../core/api-client/base-api.service";
import { resendInviteResponseSchema } from "../../../auth";
import {
  createSpeakerResponseSchema,
  getSpeakersResponseSchema,
  ownSpeakerProfileResponseSchema,
  speakerPhotoResponseSchema,
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

describe("speakersApiService.resendInvite", () => {
  it("posts to the speaker's resend-invite URL with no body, and parses the answer", () => {
    speakersApiService.resendInvite("ananya-rao-3f9a1c");

    expect(apiRequest).toHaveBeenCalledWith(
      { method: "POST", url: "/speakers/ananya-rao-3f9a1c/resend-invite" },
      resendInviteResponseSchema,
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

describe("speakersApiService own profile", () => {
  it("reads the own profile and parses it with the form's schema", () => {
    speakersApiService.getOwnProfile();

    expect(apiRequest).toHaveBeenCalledWith(
      { method: "GET", url: "/me/speaker-profile" },
      ownSpeakerProfileResponseSchema,
    );
  });

  it("patches the body and parses the saved profile", () => {
    const body = { company: "Acme", websiteUrl: null };

    speakersApiService.updateOwnProfile(body);

    expect(apiRequest).toHaveBeenCalledWith(
      { method: "PATCH", url: "/me/speaker-profile", data: body },
      ownSpeakerProfileResponseSchema,
    );
  });

  it("posts the photo as multipart form data in the field the server reads", () => {
    const file = new File(["x"], "me.png", { type: "image/png" });

    speakersApiService.uploadOwnPhoto(file);

    // No JSON content type: the browser adds multipart/form-data with its boundary.
    expect(apiRequest).toHaveBeenCalledWith(
      {
        method: "POST",
        url: "/me/speaker-profile/photo",
        data: expect.any(FormData),
        headers: { "Content-Type": undefined },
      },
      speakerPhotoResponseSchema,
    );
    const [config] = jest.mocked(apiRequest).mock.calls[0];
    expect((config.data as FormData).get("files")).toBe(file);
  });
});
