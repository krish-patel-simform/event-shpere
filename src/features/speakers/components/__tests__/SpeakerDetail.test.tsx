/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { useHasPermission } from "@/src/features/auth";
import { ananyaProfile } from "../../__fixtures__/speakers";
import { speakersApiService } from "../../api/speakers-api.service";
import type { SpeakerProfileDto } from "../../schemas/speaker.schemas";
import { SpeakerDetail } from "../SpeakerDetail";

jest.mock("../../api/speakers-api.service", () => ({
  speakersApiService: {
    list: jest.fn(),
    get: jest.fn(),
    create: jest.fn(),
    resendInvite: jest.fn(),
  },
}));
jest.mock("@/src/features/auth", () => ({
  ...jest.requireActual("@/src/features/auth"),
  useHasPermission: jest.fn(),
}));
const api = jest.mocked(speakersApiService);
const hasPermission = jest.mocked(useHasPermission);

function renderPage(slug = ananyaProfile.slug) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SpeakerDetail slug={slug} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.resetAllMocks();
  api.get.mockResolvedValue(ananyaProfile);
  hasPermission.mockReturnValue(false);
});

describe("SpeakerDetail: Resend invite", () => {
  beforeEach(() => {
    api.resendInvite.mockResolvedValue({
      setupEmailQueued: true,
      expiresAt: "2026-10-30T09:00:00.000Z",
    });
  });

  it("is not shown without the SPEAKER_MANAGE_ALL permission", async () => {
    hasPermission.mockReturnValue(false);
    renderPage();
    await screen.findByRole("heading", { name: "Ananya Rao" });

    expect(hasPermission).toHaveBeenCalledWith("SPEAKER_MANAGE_ALL");
    expect(
      screen.queryByRole("button", { name: "Resend invite" }),
    ).not.toBeInTheDocument();
  });

  it("is shown to the admin, and sends the invite for this speaker", async () => {
    hasPermission.mockImplementation((code) => code === "SPEAKER_MANAGE_ALL");
    renderPage();
    await screen.findByRole("heading", { name: "Ananya Rao" });

    await userEvent.click(
      screen.getByRole("button", { name: "Resend invite" }),
    );

    expect(api.resendInvite).toHaveBeenCalledWith("ananya-rao-3f9a1c");
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Invite sent to Ananya Rao",
    );
  });

  it("shows why it failed", async () => {
    api.resendInvite.mockRejectedValue(
      new ApiError(429, "RATE_LIMITED", "An invite was sent moments ago."),
    );
    hasPermission.mockReturnValue(true);
    renderPage();
    await screen.findByRole("heading", { name: "Ananya Rao" });

    await userEvent.click(
      screen.getByRole("button", { name: "Resend invite" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "An invite was sent moments ago.",
    );
  });
});

describe("SpeakerDetail", () => {
  it("shows a loading state first, then the speaker", async () => {
    renderPage();
    expect(
      screen.getByRole("status", { name: "Loading speaker" }),
    ).toBeInTheDocument();

    expect(
      await screen.findByRole("heading", { name: "Ananya Rao", level: 1 }),
    ).toBeVisible();
    expect(
      screen.queryByRole("status", { name: "Loading speaker" }),
    ).not.toBeInTheDocument();
  });

  it("asks the API for this speaker's slug", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Ananya Rao" });

    expect(api.get).toHaveBeenCalledWith("ananya-rao-3f9a1c");
  });

  it("shows the role, the topics, the photo and the bio paragraphs", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Ananya Rao" });

    expect(
      screen.getByText("Principal Frontend Engineer · Northwind Labs"),
    ).toBeVisible();
    expect(
      within(screen.getByRole("list", { name: "Topics" }))
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Next.js", "TypeScript"]);
    expect(
      screen.getByRole("img", { name: "Ananya Rao on stage" }),
    ).toBeVisible();
    expect(
      screen.getByText("Ananya leads frontend platform work."),
    ).toBeVisible();
    expect(
      screen.getByText("She mentors early-career engineers."),
    ).toBeVisible();
  });

  it("links to the links the speaker has, in a new tab, and leaves out the rest", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Ananya Rao" });

    const website = screen.getByRole("link", { name: "Website" });
    expect(website).toHaveAttribute("href", "https://ananya.dev");
    expect(website).toHaveAttribute("target", "_blank");
    expect(website).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByRole("link", { name: "LinkedIn" })).toHaveAttribute(
      "href",
      "https://linkedin.com/in/ananya",
    );
    expect(
      screen.queryByRole("link", { name: "X / Twitter" }),
    ).not.toBeInTheDocument();
  });

  it("has a way back to the speakers", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Ananya Rao" });

    expect(screen.getByRole("link", { name: "Speakers" })).toHaveAttribute(
      "href",
      "/speakers",
    );
  });

  it("says so when the speaker has no bio yet", async () => {
    const noBio: SpeakerProfileDto = {
      ...ananyaProfile,
      profile: ananyaProfile.profile && { ...ananyaProfile.profile, bio: [] },
    };
    api.get.mockResolvedValue(noBio);
    renderPage();

    expect(
      await screen.findByText("This speaker has not added a bio yet."),
    ).toBeVisible();
  });

  it("shows the name and 'Profile coming soon' when the CMS has nothing right now", async () => {
    api.get.mockResolvedValue({ ...ananyaProfile, profile: null });
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Ananya Rao", level: 1 }),
    ).toBeVisible();
    expect(screen.getByText("Profile coming soon")).toBeVisible();
    expect(
      screen.queryByRole("link", { name: "Website" }),
    ).not.toBeInTheDocument();
  });

  it("shows 'Speaker not found' with a way back for an unknown speaker", async () => {
    api.get.mockRejectedValue(
      new ApiError(404, "NOT_FOUND", "Speaker not found"),
    );
    renderPage("nobody-000000");

    expect(
      await screen.findByText("Speaker not found", {
        selector: "p, div, h3, strong",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Back to speakers" }),
    ).toHaveAttribute("href", "/speakers");
  });

  it("shows the error with Try again for any other failure", async () => {
    api.get.mockRejectedValueOnce(
      new ApiError(500, "INTERNAL_ERROR", "Something went wrong"),
    );
    renderPage();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("We couldn't load this speaker");
    expect(alert).toHaveTextContent("Something went wrong");

    await userEvent.click(
      within(alert).getByRole("button", { name: "Try again" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Ananya Rao", level: 1 }),
    ).toBeVisible();
  });
});
