/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { renderWithClient } from "../../__fixtures__/render";
import { eventApiService } from "../../api/event-api.service";
import { EVENT_ROUTES } from "../../routes";
import type { PublicEventDetailDto } from "../../schemas/event-public.schemas";
import { PublicEventDetail } from "../PublicEventDetail";

jest.mock("../../api/event-api.service", () => ({
  eventApiService: { getPublic: jest.fn() },
}));
const api = jest.mocked(eventApiService);

const SESSION_ONE = "3f2b8a10-6c4d-4e57-8b19-0a1d2c3e4f01";
const SESSION_TWO = "3f2b8a10-6c4d-4e57-8b19-0a1d2c3e4f02";
const SESSION_THREE = "3f2b8a10-6c4d-4e57-8b19-0a1d2c3e4f03";

const ananya = {
  slug: "ananya-rao",
  name: "Ananya Rao",
  role: "speaker" as const,
};

const detail = (
  overrides: Partial<PublicEventDetailDto> = {},
): PublicEventDetailDto => ({
  slug: "product-engineering-summit-2026",
  title: "Product Engineering Summit 2026",
  status: "published",
  startAt: "2026-12-03T03:30:00.000Z",
  endAt: "2026-12-05T12:30:00.000Z",
  timezone: "Asia/Kolkata",
  venue: {
    name: "Convention Centre",
    addressLine: "12 MG Road",
    city: "Pune",
    state: "Maharashtra",
    postalCode: "411001",
  },
  ticketPrice: 150000,
  seatsLeft: 120,
  registrationOpensAt: null,
  registrationClosesAt: null,
  content: {
    tagline: "Three days for people who build products",
    about: "First paragraph.\n\nSecond paragraph.",
    venueGuide: "Enter by Gate 2.",
    highlights: [{ title: "Live polls", description: "In every hall" }],
    faqs: [
      { question: "Do I book sessions?", answer: "Yes, after registering." },
    ],
    seo: { metaTitle: null, metaDescription: null },
    coverImage: null,
    gallery: [],
  },
  sessions: [
    {
      id: SESSION_ONE,
      title: "Opening Keynote",
      type: "keynote",
      mode: "in_person",
      startAt: "2026-12-03T04:00:00.000Z",
      endAt: "2026-12-03T05:00:00.000Z",
      hallName: "Main Hall",
      price: 0,
      requiresRegistration: false,
      speakers: [ananya],
    },
    {
      id: SESSION_TWO,
      title: "Hands-on Workshop",
      type: "workshop",
      mode: "in_person",
      startAt: "2026-12-04T08:30:00.000Z",
      endAt: "2026-12-04T10:30:00.000Z",
      hallName: "Lab 3",
      price: 50000,
      requiresRegistration: true,
      speakers: [ananya],
    },
    {
      id: SESSION_THREE,
      title: "Unscheduled idea",
      type: "talk",
      mode: "online",
      startAt: null,
      endAt: null,
      hallName: null,
      price: 0,
      requiresRegistration: false,
      speakers: [],
    },
  ],
  ...overrides,
});

beforeEach(() => {
  jest.resetAllMocks();
  api.getPublic.mockResolvedValue(detail());
});

describe("PublicEventDetail", () => {
  it("asks for the event by its slug and shows a skeleton while it loads", () => {
    api.getPublic.mockReturnValue(new Promise(() => {}));
    renderWithClient(<PublicEventDetail slug="summit" />);

    expect(api.getPublic).toHaveBeenCalledWith("summit");
    expect(
      screen.getByRole("status", { name: "Loading event" }),
    ).toBeInTheDocument();
  });

  it("shows the title, tagline, dates, place and price", async () => {
    renderWithClient(<PublicEventDetail slug="summit" />);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Product Engineering Summit 2026",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Three days for people who build products"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Thu 3 – Sat 5 Dec 2026/)).toBeInTheDocument();
    expect(screen.getByText("Convention Centre, Pune")).toBeInTheDocument();
    const box = within(
      screen.getByRole("complementary", { name: "Registration" }),
    );
    expect(box.getByText("₹1,500")).toBeInTheDocument();
    expect(box.getByText("120 seats left")).toBeInTheDocument();
  });

  it("links back to the events list", async () => {
    renderWithClient(<PublicEventDetail slug="summit" />);

    expect(await screen.findByRole("link", { name: "Events" })).toHaveAttribute(
      "href",
      EVENT_ROUTES.browse,
    );
  });

  it("writes the description as paragraphs, with highlights and FAQ", async () => {
    renderWithClient(<PublicEventDetail slug="summit" />);

    expect(await screen.findByText("First paragraph.")).toBeInTheDocument();
    expect(screen.getByText("Second paragraph.")).toBeInTheDocument();
    expect(screen.getByText("Live polls")).toBeInTheDocument();
    expect(screen.getByText("Do I book sessions?")).toBeInTheDocument();
    expect(screen.getByText("Enter by Gate 2.")).toBeInTheDocument();
  });

  it("has a link to each section that has content", async () => {
    renderWithClient(<PublicEventDetail slug="summit" />);
    await screen.findByRole("heading", { level: 1 });

    const nav = within(
      screen.getByRole("navigation", { name: "Event sections" }),
    );
    expect(nav.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "About",
      "Schedule",
      "Speakers",
      "Venue",
      "FAQ",
    ]);
  });

  it("shows the registration button switched off, marked Static", async () => {
    renderWithClient(<PublicEventDetail slug="summit" />);
    await screen.findByRole("heading", { level: 1 });

    const box = within(
      screen.getByRole("complementary", { name: "Registration" }),
    );
    expect(box.getByRole("button", { name: "Register" })).toBeDisabled();
    expect(box.getByText("Static")).toBeInTheDocument();
  });

  it("says when registration opens", async () => {
    api.getPublic.mockResolvedValue(
      detail({ registrationOpensAt: "2099-01-10T00:00:00.000Z" }),
    );
    renderWithClient(<PublicEventDetail slug="summit" />);

    expect(await screen.findByText(/Registration opens/)).toBeInTheDocument();
  });

  it("shows a cancelled event with a banner and no way to register", async () => {
    api.getPublic.mockResolvedValue(detail({ status: "cancelled" }));
    renderWithClient(<PublicEventDetail slug="summit" />);

    expect(
      await screen.findByText("This event was cancelled", {
        selector: "p, div, strong, span",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Register" }),
    ).not.toBeInTheDocument();
  });

  it("still shows the facts when the CMS did not answer", async () => {
    api.getPublic.mockResolvedValue(detail({ content: null }));
    renderWithClient(<PublicEventDetail slug="summit" />);

    expect(
      await screen.findByText("More details are coming"),
    ).toBeInTheDocument();
    expect(screen.getByText("Convention Centre, Pune")).toBeInTheDocument();
    expect(screen.getByText("₹1,500")).toBeInTheDocument();
  });

  it("shows no venue or schedule section for an event without them", async () => {
    api.getPublic.mockResolvedValue(
      detail({ venue: null, sessions: [], content: null }),
    );
    renderWithClient(<PublicEventDetail slug="summit" />);
    await screen.findByRole("heading", { level: 1 });

    expect(screen.getByText("Venue to be announced")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Schedule" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Venue" }),
    ).not.toBeInTheDocument();
  });
});

describe("the schedule and speakers", () => {
  it("shows one day at a time, each session with time, hall and speaker", async () => {
    const user = userEvent.setup();
    renderWithClient(<PublicEventDetail slug="summit" />);
    await screen.findByRole("heading", { name: "Schedule" });

    const day = within(screen.getByRole("tabpanel"));
    expect(day.getByText("Opening Keynote")).toBeInTheDocument();
    expect(day.getByText("09:30")).toBeInTheDocument();
    expect(day.getByText("60 min")).toBeInTheDocument();
    expect(day.getByText(/Main Hall/)).toBeInTheDocument();
    expect(day.queryByText("Hands-on Workshop")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Fri 4" }));

    const next = within(screen.getByRole("tabpanel"));
    expect(next.getByText("Hands-on Workshop")).toBeInTheDocument();
    expect(next.getByText("+ ₹500")).toBeInTheDocument();
    expect(next.queryByText("Opening Keynote")).not.toBeInTheDocument();
  });

  it("leaves a session without a time off the programme", async () => {
    renderWithClient(<PublicEventDetail slug="summit" />);
    await screen.findByRole("heading", { name: "Schedule" });

    expect(screen.queryByText("Unscheduled idea")).not.toBeInTheDocument();
  });

  it("lists each speaker once, linking to their page", async () => {
    renderWithClient(<PublicEventDetail slug="summit" />);
    const heading = await screen.findByRole("heading", {
      name: "Speakers (1)",
    });

    const section = within(heading.closest("section")!);
    expect(section.getByRole("link", { name: "Ananya Rao" })).toHaveAttribute(
      "href",
      "/speakers/ananya-rao",
    );
    expect(section.getByText("2 sessions")).toBeInTheDocument();
  });
});

describe("PublicEventDetail: not found, error", () => {
  it("says so for an unknown or draft event, with a way back", async () => {
    api.getPublic.mockRejectedValue(
      new ApiError(404, "NOT_FOUND", "No such event"),
    );
    renderWithClient(<PublicEventDetail slug="nope" />);

    expect(
      await screen.findByRole("heading", {
        name: "We couldn't find that event",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse events" })).toHaveAttribute(
      "href",
      EVENT_ROUTES.browse,
    );
  });

  it("shows the server's message with a way to try again for any other failure", async () => {
    const user = userEvent.setup();
    api.getPublic.mockRejectedValueOnce(
      new ApiError(503, "UNAVAILABLE", "Try again in a moment"),
    );
    renderWithClient(<PublicEventDetail slug="summit" />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't load this event",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Try again in a moment",
    );
    await user.click(screen.getByRole("button", { name: "Try again" }));

    await screen.findByRole("heading", { level: 1 });
    expect(api.getPublic).toHaveBeenCalledTimes(2);
  });
});
