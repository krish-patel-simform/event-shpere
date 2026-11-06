/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { renderWithClient } from "../../__fixtures__/render";
import { sessionApiService } from "../../api/session-api.service";
import type { PublicSessionDetailDto } from "../../schemas/session-public.schemas";
import { PublicSessionDetail } from "../PublicSessionDetail";

jest.mock("../../api/session-api.service", () => ({
  sessionApiService: { getPublic: jest.fn() },
}));
const api = jest.mocked(sessionApiService);

const SESSION_ID = "3f2b8a10-6c4d-4e57-8b19-0a1d2c3e4f01";

const detail = (
  overrides: Partial<PublicSessionDetailDto> = {},
): PublicSessionDetailDto => ({
  id: SESSION_ID,
  title: "Offline-first Event Apps",
  type: "workshop",
  mode: "in_person",
  startAt: "2026-12-04T04:30:00.000Z",
  endAt: "2026-12-04T06:30:00.000Z",
  hallName: "Lab 3",
  price: 50000,
  requiresRegistration: true,
  speakers: [
    { slug: "ananya-rao", name: "Ananya Rao", role: "speaker" },
    { slug: "dev-shah", name: "Dev Shah", role: "moderator" },
  ],
  event: {
    slug: "summit",
    title: "Product Engineering Summit 2026",
    status: "published",
    timezone: "Asia/Kolkata",
  },
  content: {
    description: "First paragraph.\n\nSecond paragraph.",
    prerequisites: "Basic React",
    resources: [{ label: "Slides", url: "https://example.com/slides" }],
    coverImage: {
      url: "https://cms.test/cover.jpg",
      alt: "The lab",
      width: 1600,
      height: 900,
    },
  },
  ...overrides,
});

beforeEach(() => {
  jest.resetAllMocks();
  api.getPublic.mockResolvedValue(detail());
});

describe("PublicSessionDetail", () => {
  it("asks for the session by the event's link and its id, and shows a skeleton while it loads", () => {
    api.getPublic.mockReturnValue(new Promise(() => {}));
    renderWithClient(
      <PublicSessionDetail slug="summit" sessionId={SESSION_ID} />,
    );

    expect(api.getPublic).toHaveBeenCalledWith("summit", SESSION_ID);
    expect(
      screen.getByRole("status", { name: "Loading session" }),
    ).toBeInTheDocument();
  });

  it("shows the title, type, mode, day, time (in the event's zone) and hall", async () => {
    renderWithClient(
      <PublicSessionDetail slug="summit" sessionId={SESSION_ID} />,
    );

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Offline-first Event Apps",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Workshop")).toBeInTheDocument();
    expect(screen.getByText("In person")).toBeInTheDocument();
    expect(
      screen.getByText(/Fri 4 Dec 2026 · 10:00 – 12:00 IST/),
    ).toBeInTheDocument();
    expect(screen.getByText("Lab 3")).toBeInTheDocument();
  });

  it("links back to the events list and to the event", async () => {
    renderWithClient(
      <PublicSessionDetail slug="summit" sessionId={SESSION_ID} />,
    );
    await screen.findByRole("heading", { level: 1 });

    const crumbs = within(
      screen.getByRole("navigation", { name: /breadcrumb/i }),
    );
    expect(crumbs.getByRole("link", { name: "Events" })).toHaveAttribute(
      "href",
      "/events",
    );
    expect(
      crumbs.getByRole("link", { name: "Product Engineering Summit 2026" }),
    ).toHaveAttribute("href", "/events/summit");
  });

  it("writes the description as paragraphs, then the prerequisites and the resources", async () => {
    renderWithClient(
      <PublicSessionDetail slug="summit" sessionId={SESSION_ID} />,
    );

    expect(await screen.findByText("First paragraph.")).toBeInTheDocument();
    expect(screen.getByText("Second paragraph.")).toBeInTheDocument();
    expect(screen.getByText("Basic React")).toBeInTheDocument();
    const slides = screen.getByRole("link", { name: "Slides" });
    expect(slides).toHaveAttribute("href", "https://example.com/slides");
    expect(slides).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("links each speaker to their page and names a role that is not the usual one", async () => {
    renderWithClient(
      <PublicSessionDetail slug="summit" sessionId={SESSION_ID} />,
    );
    await screen.findByRole("heading", { level: 1 });

    expect(screen.getByRole("link", { name: "Ananya Rao" })).toHaveAttribute(
      "href",
      "/speakers/ananya-rao",
    );
    expect(screen.getByRole("link", { name: "Dev Shah" })).toBeInTheDocument();
    expect(screen.getByText("Moderator")).toBeInTheDocument();
    expect(
      screen.queryByText("Speaker", { selector: "span" }),
    ).not.toBeInTheDocument();
  });

  it("shows the price on top of the ticket and that a seat is needed", async () => {
    renderWithClient(
      <PublicSessionDetail slug="summit" sessionId={SESSION_ID} />,
    );
    await screen.findByRole("heading", { level: 1 });

    const box = within(screen.getByRole("region", { name: "Attending" }));
    expect(box.getByText("+ ₹500")).toBeInTheDocument();
    expect(box.getByText("Registration required")).toBeInTheDocument();
  });

  it("says a free session is part of the event ticket", async () => {
    api.getPublic.mockResolvedValue(
      detail({ price: 0, requiresRegistration: false }),
    );
    renderWithClient(
      <PublicSessionDetail slug="summit" sessionId={SESSION_ID} />,
    );

    expect(
      await screen.findByText("Included in the event ticket"),
    ).toBeInTheDocument();
    expect(screen.getByText("No separate registration")).toBeInTheDocument();
  });

  it("shows the cover from the CMS", async () => {
    renderWithClient(
      <PublicSessionDetail slug="summit" sessionId={SESSION_ID} />,
    );

    expect(await screen.findByAltText("The lab")).toHaveAttribute(
      "src",
      "https://cms.test/cover.jpg",
    );
  });

  it("says when the organizer wrote no description", async () => {
    api.getPublic.mockResolvedValue(
      detail({
        content: {
          description: "",
          prerequisites: null,
          resources: [],
          coverImage: null,
        },
      }),
    );
    renderWithClient(
      <PublicSessionDetail slug="summit" sessionId={SESSION_ID} />,
    );

    expect(
      await screen.findByText("The organizer has not added a description."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Before you come")).not.toBeInTheDocument();
    expect(screen.queryByText("Resources")).not.toBeInTheDocument();
  });

  it("keeps the facts and says more is coming when the CMS did not answer", async () => {
    api.getPublic.mockResolvedValue(detail({ content: null }));
    renderWithClient(
      <PublicSessionDetail slug="summit" sessionId={SESSION_ID} />,
    );

    expect(
      await screen.findByText("More details are coming"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Offline-first Event Apps",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ananya Rao" }),
    ).toBeInTheDocument();
  });

  it("says a session without a slot has no time yet, and an online one is Online", async () => {
    api.getPublic.mockResolvedValue(
      detail({ mode: "online", hallName: null, startAt: null, endAt: null }),
    );
    renderWithClient(
      <PublicSessionDetail slug="summit" sessionId={SESSION_ID} />,
    );

    expect(await screen.findByText("Time to be announced")).toBeInTheDocument();
    expect(screen.getAllByText("Online").length).toBeGreaterThan(0);
  });

  it("shows a cancelled event's session with a banner", async () => {
    api.getPublic.mockResolvedValue(
      detail({ event: { ...detail().event, status: "cancelled" } }),
    );
    renderWithClient(
      <PublicSessionDetail slug="summit" sessionId={SESSION_ID} />,
    );

    expect(
      await screen.findByText("This event was cancelled"),
    ).toBeInTheDocument();
  });
});

describe("when the session cannot be shown", () => {
  it.each([404, 400])(
    "shows 'not found' with a way back for a %i",
    async (status) => {
      api.getPublic.mockRejectedValue(
        new ApiError(status, "NOT_FOUND", "Session not found"),
      );
      renderWithClient(
        <PublicSessionDetail slug="summit" sessionId={SESSION_ID} />,
      );

      expect(
        await screen.findByRole("heading", {
          name: "We couldn't find that session",
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "Back to the event" }),
      ).toHaveAttribute("href", "/events/summit");
      // A final answer is not asked for again.
      expect(api.getPublic).toHaveBeenCalledTimes(1);
    },
  );

  it("shows an error with a retry for any other failure", async () => {
    const user = userEvent.setup();
    // Fails on every try (the hook retries a non-404), until the user clicks "Try again".
    api.getPublic.mockRejectedValue(new Error("Network down"));
    renderWithClient(
      <PublicSessionDetail slug="summit" sessionId={SESSION_ID} />,
    );

    expect(
      await screen.findByText("We couldn't load this session"),
    ).toBeInTheDocument();

    api.getPublic.mockResolvedValue(detail());
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Offline-first Event Apps",
      }),
    ).toBeInTheDocument();
  });
});
