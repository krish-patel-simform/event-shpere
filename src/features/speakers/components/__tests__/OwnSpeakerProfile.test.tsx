/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { speakersApiService } from "../../api/speakers-api.service";
import type { OwnSpeakerProfileDto } from "../../schemas/speaker.schemas";
import { OWN_SPEAKER_PROFILE_SAMPLE } from "../../utils/own-profile.sample";
import { OwnSpeakerProfile } from "../OwnSpeakerProfile";

jest.mock("../../api/speakers-api.service", () => ({
  speakersApiService: {
    getOwnProfile: jest.fn(),
    updateOwnProfile: jest.fn(),
    uploadOwnPhoto: jest.fn(),
  },
}));
const api = jest.mocked(speakersApiService);

const profile: OwnSpeakerProfileDto = OWN_SPEAKER_PROFILE_SAMPLE;
const newPhoto = {
  url: "https://cms.example.com/new.png",
  alt: "Ananya Rao",
  width: 200,
  height: 200,
};

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <OwnSpeakerProfile />
    </QueryClientProvider>,
  );
  return client;
}

const save = () => screen.getByRole("button", { name: "Save profile" });

beforeEach(() => {
  jest.resetAllMocks();
  URL.createObjectURL = jest.fn(() => "blob:preview");
  URL.revokeObjectURL = jest.fn();
  api.getOwnProfile.mockResolvedValue(profile);
});

describe("OwnSpeakerProfile: loading", () => {
  it("shows the skeleton, then the form with the saved values", async () => {
    renderPage();
    expect(
      screen.getByRole("status", { name: "Loading your profile" }),
    ).toBeInTheDocument();

    expect(await screen.findByDisplayValue("Northwind Labs")).toBeVisible();
    expect(
      screen.queryByRole("status", { name: "Loading your profile" }),
    ).toBeNull();
  });

  it("shows the error and loads again on Try again", async () => {
    api.getOwnProfile.mockRejectedValueOnce(
      new ApiError(0, "NETWORK_ERROR", "Could not reach the server."),
    );
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not reach the server.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByDisplayValue("Northwind Labs")).toBeVisible();
    expect(api.getOwnProfile).toHaveBeenCalledTimes(2);
  });
});

describe("OwnSpeakerProfile: saving", () => {
  it("patches the changed form with the parsed body and shows it saved", async () => {
    api.updateOwnProfile.mockResolvedValue({ ...profile, company: "Acme" });
    renderPage();
    const company = await screen.findByRole("textbox", { name: /Company/ });
    await userEvent.clear(company);
    await userEvent.type(company, "Acme");
    await userEvent.click(save());

    expect(await screen.findByText("Profile saved")).toBeInTheDocument();
    expect(api.updateOwnProfile).toHaveBeenCalledWith(
      expect.objectContaining({ company: "Acme", firstName: "Ananya" }),
    );
    expect(api.uploadOwnPhoto).not.toHaveBeenCalled();
  });

  it("uploads the chosen photo, then shows the one the server answered with", async () => {
    api.uploadOwnPhoto.mockResolvedValue({ photo: newPhoto });
    renderPage();
    await screen.findByDisplayValue("Northwind Labs");
    const file = new File(["x"], "me.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Photo file"), {
      target: { files: [file] },
    });
    await userEvent.click(save());

    expect(await screen.findByText("Profile saved")).toBeInTheDocument();
    expect(api.uploadOwnPhoto).toHaveBeenCalledWith(file);
    expect(api.updateOwnProfile).not.toHaveBeenCalled();
    // The cache got the new photo, so the form shows the stored one (not the local preview).
    expect(screen.getByRole("img")).toHaveAttribute("src", newPhoto.url);
  });

  it("shows the server's message when saving fails", async () => {
    api.updateOwnProfile.mockRejectedValue(
      new ApiError(503, "CMS_UNAVAILABLE", "The content service is down."),
    );
    renderPage();
    const company = await screen.findByRole("textbox", { name: /Company/ });
    await userEvent.type(company, "!");
    await userEvent.click(save());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The content service is down.",
    );
  });
});
