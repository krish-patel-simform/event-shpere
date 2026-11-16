/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { speakersApiService } from "@/src/features/speakers/api/speakers-api.service";
import { renderWithClient } from "../../__fixtures__/render";
import { sessionApiService } from "../../api/session-api.service";
import type { PublicSessionDetailDto } from "../../schemas/session-public.schemas";
import { PublicSessionDetail } from "../PublicSessionDetail";

jest.mock("../../api/session-api.service", () => ({
  sessionApiService: { getPublic: jest.fn() },
}));
jest.mock("@/src/features/speakers/api/speakers-api.service", () => ({
  speakersApiService: { list: jest.fn() },
}));
const api = jest.mocked(sessionApiService);
const speakersApi = jest.mocked(speakersApiService);

const SESSION_ID = "3f2b8a10-6c4d-4e57-8b19-0a1d2c3e4f01";
const ANANYA_ID = "6b2c3d4e-5f6a-4b7c-9d8e-0f1a2b3c4d01";
const DEV_ID = "6b2c3d4e-5f6a-4b7c-9d8e-0f1a2b3c4d02";

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
  hallCapacity: 120,
  seatsLeft: 32,
  venue: {
    name: "Tech Park Auditorium",
    addressLine: "12 MG Road",
    city: "Pune",
  },
  price: 50000,
  requiresRegistration: true,
  speakers: [
    { id: ANANYA_ID, slug: "ananya-rao", name: "Ananya Rao", role: "speaker" },
    { id: DEV_ID, slug: "dev-shah", name: "Dev Shah", role: "moderator" },
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

/** The speakers list's answer for the two speakers: Ananya has a photo, a job title and a company. */
const speakerCards = [
  {
    id: ANANYA_ID,
    slug: "ananya-rao",
    firstName: "Ananya",
    lastName: "Rao",
    profile: {
      photo: {
        url: "https://cms.test/ananya.jpg",
        alt: "Ananya on stage",
        width: 400,
        height: 400,
      },
      jobTitle: "Principal Frontend Engineer",
      company: "Northwind Labs",
      expertise: [],
    },
  },
  {
    id: DEV_ID,
    slug: "dev-shah",
    firstName: "Dev",
    lastName: "Shah",
    profile: null,
  },
];

function show(overrides: Partial<PublicSessionDetailDto> = {}) {
  api.getPublic.mockResolvedValue(detail(overrides));
  return renderWithClient(
    <PublicSessionDetail slug="summit" sessionId={SESSION_ID} />,
  );
}

beforeEach(() => {
  jest.resetAllMocks();
  api.getPublic.mockResolvedValue(detail());
  speakersApi.list.mockResolvedValue({
    items: speakerCards,
    meta: { page: 1, pageSize: 2, total: 2 },
  });
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

  it("shows the title, type, format, day, time (in the event's zone) and where it is", async () => {
    show();

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Offline-first Event Apps",
      }),
    ).toBeInTheDocument();
    const hero = within(
      screen.getByRole("region", { name: "Offline-first Event Apps" }),
    );
    expect(hero.getByText("Workshop")).toBeInTheDocument();
    expect(hero.getByText("In person")).toBeInTheDocument();
    expect(hero.getByText("+ ₹500")).toBeInTheDocument();
    expect(
      hero.getByText(/Fri 4 Dec 2026 · 10:00 – 12:00 IST/),
    ).toBeInTheDocument();
    expect(
      hero.getByText("Lab 3 · Tech Park Auditorium, Pune"),
    ).toBeInTheDocument();
  });

  it("links back to the events list and to the event", async () => {
    show();
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

  it("has no 'more sessions' section", async () => {
    show();
    await screen.findByRole("heading", { level: 1 });

    expect(screen.queryByText(/more sessions/i)).not.toBeInTheDocument();
  });
});

describe("the cover", () => {
  it("shows the cover from the CMS in the hero", async () => {
    show();

    expect(await screen.findByAltText("The lab")).toHaveAttribute(
      "src",
      "https://cms.test/cover.jpg",
    );
  });

  it("shows a soft panel instead when there is no cover, and no broken image", async () => {
    show({
      content: {
        description: "Text.",
        prerequisites: null,
        resources: [],
        coverImage: null,
      },
    });
    await screen.findByRole("heading", { level: 1 });

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    // The type and format are still on the hero.
    expect(
      within(
        screen.getByRole("region", { name: "Offline-first Event Apps" }),
      ).getByText("Workshop"),
    ).toBeInTheDocument();
  });

  it("shows the hero without a cover when the CMS did not answer", async () => {
    show({ content: null });

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Offline-first Event Apps",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByAltText("The lab")).not.toBeInTheDocument();
  });
});

describe("the description", () => {
  it("writes it as paragraphs, then the prerequisites and the resources", async () => {
    show();

    expect(await screen.findByText("First paragraph.")).toBeInTheDocument();
    expect(screen.getByText("Second paragraph.")).toBeInTheDocument();
    expect(screen.getByText("Basic React")).toBeInTheDocument();
    const slides = screen.getByRole("link", { name: "Slides" });
    expect(slides).toHaveAttribute("href", "https://example.com/slides");
    expect(slides).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("says when the organizer wrote no description", async () => {
    show({
      content: {
        description: "",
        prerequisites: null,
        resources: [],
        coverImage: null,
      },
    });

    expect(
      await screen.findByText("The organizer has not added a description."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Before you come")).not.toBeInTheDocument();
    expect(screen.queryByText("Resources")).not.toBeInTheDocument();
  });

  it("keeps the facts and says more is coming when the CMS did not answer", async () => {
    show({ content: null });

    expect(
      await screen.findByText("More details are coming"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ananya Rao" }),
    ).toBeInTheDocument();
  });
});

describe("the speakers", () => {
  it("asks the speakers list for these speakers only", async () => {
    show();
    await screen.findByRole("heading", { level: 1 });

    expect(speakersApi.list).toHaveBeenCalledWith(
      expect.objectContaining({ ids: [ANANYA_ID, DEV_ID], pageSize: 2 }),
    );
  });

  it("links each speaker to their page and names a role that is not the usual one", async () => {
    show();
    await screen.findByRole("heading", { level: 1 });

    const card = within(screen.getByRole("region", { name: "Speakers" }));
    expect(card.getByRole("link", { name: "Ananya Rao" })).toHaveAttribute(
      "href",
      "/speakers/ananya-rao",
    );
    expect(card.getByRole("link", { name: "Dev Shah" })).toBeInTheDocument();
    expect(card.getByText("Moderator")).toBeInTheDocument();
    expect(card.queryByText("Speaker")).not.toBeInTheDocument();
  });

  it("shows the photo, job title and company from the speakers list", async () => {
    show();

    expect(await screen.findByAltText("Ananya on stage")).toHaveAttribute(
      "src",
      "https://cms.test/ananya.jpg",
    );
    expect(
      screen.getByText("Principal Frontend Engineer · Northwind Labs"),
    ).toBeInTheDocument();
  });

  it("shows initials and the names when the speakers list fails", async () => {
    speakersApi.list.mockRejectedValue(new ApiError(500, "INTERNAL", "Down"));
    show();
    await screen.findByRole("heading", { level: 1 });

    const card = within(screen.getByRole("region", { name: "Speakers" }));
    expect(card.getByRole("link", { name: "Ananya Rao" })).toBeInTheDocument();
    expect(card.getByText("AR")).toBeInTheDocument();
    expect(card.queryByText(/Northwind/)).not.toBeInTheDocument();
  });

  it("says speakers will be announced when there are none, and asks for no list", async () => {
    show({ speakers: [] });

    expect(
      await screen.findByText("Speakers will be announced."),
    ).toBeInTheDocument();
    expect(speakersApi.list).not.toHaveBeenCalled();
  });

  it("titles the card 'Speaker' for one speaker", async () => {
    show({ speakers: [detail().speakers[0]!] });

    expect(
      await screen.findByRole("region", { name: "Speaker" }),
    ).toBeInTheDocument();
  });
});

describe("booking and attending", () => {
  it("shows the price on top of the ticket, the seats left on a bar, and a placeholder button", async () => {
    show();
    await screen.findByRole("heading", { level: 1 });

    const box = within(
      screen.getByRole("region", { name: "Book this session" }),
    );
    expect(box.getByText("₹500")).toBeInTheDocument();
    expect(box.getByText("on top of the event ticket")).toBeInTheDocument();
    expect(box.getByText("32 of 120 left")).toBeInTheDocument();
    expect(
      box.getByRole("progressbar", { name: "Seats taken" }),
    ).toHaveAttribute("aria-valuenow", "73");
    // Booking is not built yet: the button says so and does nothing.
    expect(
      box.getByRole("button", { name: "Booking opens soon" }),
    ).toBeDisabled();
    expect(box.getByRole("link", { name: "View the event" })).toHaveAttribute(
      "href",
      "/events/summit",
    );
  });

  it("says a full session is fully booked", async () => {
    show({ seatsLeft: 0 });

    expect(await screen.findByText("Fully booked")).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", { name: "Seats taken" }),
    ).toHaveAttribute("aria-valuenow", "100");
  });

  it("says a free session with no booking is part of the event ticket, with no button", async () => {
    show({ price: 0, requiresRegistration: false, seatsLeft: null });

    const box = within(
      await screen.findByRole("region", { name: "Book this session" }),
    );
    expect(box.getByText("Included")).toBeInTheDocument();
    expect(box.getByText("in your event ticket")).toBeInTheDocument();
    expect(box.getByText("No separate registration")).toBeInTheDocument();
    expect(box.queryByRole("button")).not.toBeInTheDocument();
    expect(box.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("says registration is required when the seat count is not known", async () => {
    show({
      seatsLeft: null,
      hallCapacity: null,
      hallName: null,
      mode: "online",
    });

    const box = within(
      await screen.findByRole("region", { name: "Book this session" }),
    );
    expect(box.getByText("Registration required")).toBeInTheDocument();
    expect(box.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("cannot be booked when the event was cancelled", async () => {
    show({ event: { ...detail().event, status: "cancelled" } });

    expect(
      await screen.findByText("This event was cancelled"),
    ).toBeInTheDocument();
    const box = within(
      screen.getByRole("region", { name: "Book this session" }),
    );
    expect(box.getByText(/cannot be booked/)).toBeInTheDocument();
    expect(box.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("the details", () => {
  it("lists the hall, the venue with its address, the seats, the format and the price", async () => {
    show();
    await screen.findByRole("heading", { level: 1 });

    const box = within(screen.getByRole("region", { name: "Details" }));
    expect(box.getByText("Lab 3")).toBeInTheDocument();
    expect(box.getByText("Tech Park Auditorium")).toBeInTheDocument();
    expect(box.getByText("12 MG Road, Pune")).toBeInTheDocument();
    expect(box.getByText("120")).toBeInTheDocument();
    expect(box.getByText("In person")).toBeInTheDocument();
    expect(box.getByText("+ ₹500")).toBeInTheDocument();
    expect(box.getByRole("link", { name: "Venue directions" })).toHaveAttribute(
      "href",
      "/events/summit#venue",
    );
  });

  it("leaves out the hall, venue, seats and directions for an online session", async () => {
    show({
      mode: "online",
      hallName: null,
      hallCapacity: null,
      seatsLeft: null,
      venue: null,
    });
    await screen.findByRole("heading", { level: 1 });

    const box = within(screen.getByRole("region", { name: "Details" }));
    expect(box.queryByText("Hall")).not.toBeInTheDocument();
    expect(box.queryByText("Venue")).not.toBeInTheDocument();
    expect(box.queryByText("Seats")).not.toBeInTheDocument();
    expect(
      box.queryByRole("link", { name: "Venue directions" }),
    ).not.toBeInTheDocument();
    expect(box.getByText("Online")).toBeInTheDocument();
  });
});

describe("other states", () => {
  it("says a session without a slot has no time yet, and an online one is Online", async () => {
    show({
      mode: "online",
      hallName: null,
      hallCapacity: null,
      seatsLeft: null,
      startAt: null,
      endAt: null,
    });

    expect(await screen.findByText("Time to be announced")).toBeInTheDocument();
    expect(screen.getAllByText("Online").length).toBeGreaterThan(0);
  });

  it("shows a cancelled event's session with a banner", async () => {
    show({ event: { ...detail().event, status: "cancelled" } });

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
