/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { useHasPermission } from "@/src/features/auth";
import { renderWithClient } from "../../__fixtures__/render";
import {
  DESIGN_DAY_ID,
  FINTECH_ID,
  findSampleOverview,
  FUTURES_ID,
  MEETUP_ID,
  SUMMIT_ID,
} from "../../__fixtures__/event-manage";
import { eventApiService } from "../../api/event-api.service";
import {
  eventAttendeesHref,
  eventEditHref,
  eventHallsHref,
  eventScheduleHref,
  eventSessionNewHref,
  eventSessionsHref,
  eventSpeakersHref,
  EVENT_ROUTES,
  publicEventHref,
} from "../../routes";
import type { EventContentDto } from "../../schemas/event-content.schemas";
import type { EventOverviewData } from "../../types/event-manage.types";
import { EventOverview } from "../EventOverview";

jest.mock("../../api/event-api.service", () => ({
  eventApiService: {
    listMine: jest.fn(),
    countMine: jest.fn(),
    getOverview: jest.fn(),
    getContent: jest.fn(),
    cancel: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
}));
jest.mock("@/src/features/auth", () => ({
  ...jest.requireActual("@/src/features/auth"),
  useHasPermission: jest.fn(),
}));
const api = jest.mocked(eventApiService);
const hasPermission = jest.mocked(useHasPermission);

/** What GET /api/events/[id]/content answers: a written page with a cover and two photos. */
function pageContent(
  overrides: Partial<EventContentDto> = {},
): EventContentDto {
  const photo = (id: number) => ({
    id,
    url: `https://cms.example.com/photo-${id}.jpg`,
    alt: null,
    width: null,
    height: null,
  });
  return {
    tagline: "Three days for people who build products",
    about: "First paragraph of the description.\n\nSecond paragraph.",
    venueGuide: "Enter by Gate 2.",
    highlights: [],
    faqs: [
      { question: "Do I book sessions?", answer: "Yes, after registering." },
      { question: "Can I cancel?", answer: "Yes, before the event." },
    ],
    seo: { metaTitle: null, metaDescription: null },
    coverImage: {
      id: 1,
      url: "https://cms.example.com/cover.jpg",
      alt: "Summit cover",
      width: 1600,
      height: 600,
    },
    gallery: [photo(2), photo(3)],
    ...overrides,
  };
}

function sample(id: string): EventOverviewData {
  const overview = findSampleOverview(id);
  if (!overview) throw new Error(`no sample overview ${id}`);
  return overview;
}

/** The fintech draft, ready to publish: description written and both sessions scheduled. */
function readyDraft(): EventOverviewData {
  const draft = sample(FINTECH_ID);
  return {
    ...draft,
    content: { hasDescription: true, hasBanner: true },
    event: {
      ...draft.event,
      sessions: { total: 2, scheduled: 2, cancelled: 0 },
    },
  };
}

/** Renders the overview of an event the API answers with, once it has loaded. */
async function renderOverview(overview: EventOverviewData) {
  api.getOverview.mockResolvedValue(overview);
  renderWithClient(<EventOverview eventId={overview.event.id} />);
  await screen.findByRole("heading", { level: 1, name: overview.event.title });
}

beforeEach(() => {
  jest.resetAllMocks();
  hasPermission.mockReturnValue(true);
  api.getContent.mockResolvedValue(pageContent());
});

describe("EventOverview: loading and failing", () => {
  it("asks for the event by its id, and shows a skeleton until it arrives", async () => {
    api.getOverview.mockResolvedValue(sample(FINTECH_ID));
    renderWithClient(<EventOverview eventId={FINTECH_ID} />);

    expect(
      screen.getByRole("status", { name: "Loading event" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    await screen.findByRole("heading", {
      level: 1,
      name: "Fintech Product Forum",
    });
    expect(api.getOverview).toHaveBeenCalledWith(FINTECH_ID);
    expect(
      screen.queryByRole("status", { name: "Loading event" }),
    ).not.toBeInTheDocument();
  });

  it("says so for an event that is not the organizer's (404), without retrying", async () => {
    api.getOverview.mockRejectedValue(
      new ApiError(404, "NOT_FOUND", "Event not found"),
    );
    renderWithClient(
      <EventOverview eventId="00000000-0000-4000-8000-000000000000" />,
    );

    expect(await screen.findByText("Event not found")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to My events" }),
    ).toHaveAttribute("href", EVENT_ROUTES.list);
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
    expect(api.getOverview).toHaveBeenCalledTimes(1);
  });

  it("says when it could not be loaded, and tries again", async () => {
    const user = userEvent.setup();
    api.getOverview.mockRejectedValue(
      new ApiError(503, "CMS_UNAVAILABLE", "Try again in a moment"),
    );
    renderWithClient(<EventOverview eventId={FINTECH_ID} />);

    expect(
      await screen.findByText("We couldn't load this event"),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Try again in a moment",
    );
    api.getOverview.mockResolvedValue(sample(FINTECH_ID));
    await user.click(screen.getByRole("button", { name: "Try again" }));

    await screen.findByRole("heading", {
      level: 1,
      name: "Fintech Product Forum",
    });
  });
});

describe("EventOverview: a draft", () => {
  it("shows the title, the Draft badge, the date and the venue", async () => {
    await renderOverview(sample(FINTECH_ID));

    expect(screen.getByText("Draft")).toBeInTheDocument();
    // Both are also in the Details card, so more than one match is expected.
    expect(screen.getAllByText("Sat 12 Dec 2026").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Hotel Orchid, Pune").length).toBeGreaterThan(0);
  });

  it("says registration opens when published", async () => {
    await renderOverview(sample(FINTECH_ID));

    expect(screen.getByText("Opens when published")).toBeInTheDocument();
  });

  it("lists what is done and what is missing, and blocks Publish", async () => {
    await renderOverview(sample(FINTECH_ID));

    const card = within(
      screen.getByRole("region", { name: "Ready to publish?" }),
    );
    expect(card.getByText("Event details")).toBeInTheDocument();
    expect(
      card.getByText(
        "The description is missing. A banner placeholder will be used.",
      ),
    ).toBeInTheDocument();
    expect(
      card.getByText("2 sessions are not scheduled yet."),
    ).toBeInTheDocument();
    expect(
      card.getByText("Missing: content, 2 unscheduled sessions"),
    ).toBeInTheDocument();
    expect(card.getByRole("button", { name: "Publish event" })).toBeDisabled();
  });

  it("links each missing item to the page that fixes it", async () => {
    await renderOverview(sample(FINTECH_ID));

    const card = within(
      screen.getByRole("region", { name: "Ready to publish?" }),
    );
    expect(card.getByRole("link", { name: "Write content" })).toHaveAttribute(
      "href",
      eventEditHref(FINTECH_ID, "content"),
    );
    expect(card.getByRole("link", { name: "Review sessions" })).toHaveAttribute(
      "href",
      eventSessionsHref(FINTECH_ID),
    );
    // Done items (and the halls, which only an administrator adds) have no button.
    expect(card.getAllByRole("link")).toHaveLength(2);
  });

  it("keeps Publish disabled even when nothing is missing: publishing has no endpoint yet", async () => {
    await renderOverview(readyDraft());

    expect(screen.getByText("Ready to publish")).toBeInTheDocument();
    const publish = screen.getByRole("button", { name: "Publish event" });
    expect(publish).toBeDisabled();
    expect(publish).toHaveAttribute("title", "Publishing is not available yet");
  });

  it("says the content could not be checked, and does not let it publish on a guess", async () => {
    await renderOverview({ ...readyDraft(), content: null });

    expect(
      screen.getByText(/The page content could not be checked right now/),
    ).toBeInTheDocument();
    expect(screen.getByText("Missing: content")).toBeInTheDocument();
  });

  it("asks for a venue when the draft has none", async () => {
    const draft = sample(FINTECH_ID);
    await renderOverview({ ...draft, event: { ...draft.event, venue: null } });

    expect(
      screen.getByText("Choose a venue for the event."),
    ).toBeInTheDocument();
    // In the header and in the Details card.
    expect(screen.getAllByText("No venue chosen yet").length).toBeGreaterThan(
      0,
    );
  });

  it("offers editing and the public page, and a link for every section tab", async () => {
    await renderOverview(sample(FINTECH_ID));

    expect(screen.getByRole("link", { name: "Edit event" })).toHaveAttribute(
      "href",
      eventEditHref(FINTECH_ID),
    );
    expect(
      screen.getByRole("link", { name: "View public page" }),
    ).toHaveAttribute("href", publicEventHref("fintech-product-forum"));
    const sections = within(
      screen.getByRole("navigation", { name: "Event sections" }),
    );
    expect(sections.getByRole("link", { name: "Overview" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(sections.getByRole("link", { name: /Sessions/ })).toHaveAttribute(
      "href",
      eventSessionsHref(FINTECH_ID),
    );
    // Every other section has a page too.
    expect(
      sections.getByRole("link", { name: /Schedule board/ }),
    ).toHaveAttribute("href", eventScheduleHref(FINTECH_ID));
    expect(sections.getByRole("link", { name: /Speakers/ })).toHaveAttribute(
      "href",
      eventSpeakersHref(FINTECH_ID),
    );
    expect(sections.getByRole("link", { name: /Halls/ })).toHaveAttribute(
      "href",
      eventHallsHref(FINTECH_ID),
    );
    expect(sections.getByRole("link", { name: /Attendees/ })).toHaveAttribute(
      "href",
      eventAttendeesHref(FINTECH_ID),
    );
  });

  it("shows the details, with the public link as text", async () => {
    await renderOverview(sample(FINTECH_ID));

    const details = within(screen.getByRole("region", { name: "Details" }));
    expect(details.getByText("09:30 – 17:30 IST")).toBeInTheDocument();
    expect(details.getByText("250")).toBeInTheDocument();
    expect(details.getByText("Free")).toBeInTheDocument();
    expect(
      details.getByText("/events/fintech-product-forum"),
    ).toBeInTheDocument();
    expect(details.getByRole("link", { name: "Edit" })).toHaveAttribute(
      "href",
      eventEditHref(FINTECH_ID),
    );
  });

  it("shows Delete draft switched off, marked Static, and no Cancel button", async () => {
    await renderOverview(sample(FINTECH_ID));

    const zone = within(screen.getByRole("region", { name: "Danger zone" }));
    expect(zone.getByRole("button", { name: "Delete draft" })).toBeDisabled();
    expect(
      zone.getByText("Deleting a draft is not available yet."),
    ).toBeInTheDocument();
    expect(zone.getByText("Static")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Cancel event" }),
    ).not.toBeInTheDocument();
  });

  it("offers Create session, unless the organizer may not create one", async () => {
    await renderOverview(sample(FINTECH_ID));
    expect(hasPermission).toHaveBeenCalledWith("SESSION_CREATE");
    expect(
      screen.getByRole("link", { name: "Create session" }),
    ).toHaveAttribute("href", eventSessionNewHref(FINTECH_ID));
  });

  it("hides Create session without the permission", async () => {
    hasPermission.mockReturnValue(false);
    await renderOverview(sample(FINTECH_ID));

    expect(
      screen.queryByRole("link", { name: "Create session" }),
    ).not.toBeInTheDocument();
  });
});

describe("EventOverview: a published event", () => {
  it("shows the figures", async () => {
    await renderOverview(sample(SUMMIT_ID));

    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.getByText("480 / 600")).toBeInTheDocument();
    expect(screen.getByText("120 seats left")).toBeInTheDocument();
    expect(screen.getByText("1,286")).toBeInTheDocument();
    expect(
      screen.getByText("across 22 scheduled sessions"),
    ).toBeInTheDocument();
    expect(screen.getByText("22 scheduled · 2 draft")).toBeInTheDocument();
    expect(screen.getByText("4 · 14")).toBeInTheDocument();
  });

  it("lists what needs attention", async () => {
    await renderOverview(sample(SUMMIT_ID));

    const card = within(
      screen.getByRole("region", { name: "Needs your attention" }),
    );
    expect(card.getByText("2 sessions are not scheduled")).toBeInTheDocument();
    expect(
      card.getByText(
        "“Hands-on: Type-safe APIs with TypeScript and Zod” is full",
      ),
    ).toBeInTheDocument();
    expect(card.getByText("Event is published")).toBeInTheDocument();
  });

  it("shows how full the event and its sessions are", async () => {
    await renderOverview(sample(SUMMIT_ID));

    expect(
      screen.getByRole("progressbar", { name: "Event seats taken" }),
    ).toHaveAttribute("aria-valuenow", "480");
    expect(screen.getByText("480 of 600 · 80%")).toBeInTheDocument();
    expect(screen.getByText("21 of 22")).toBeInTheDocument();
  });

  it("shows the dates with weekdays and the times in the event's zone", async () => {
    await renderOverview(sample(SUMMIT_ID));

    expect(
      screen.getAllByText("Thu 3 – Sat 5 Dec 2026").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("09:00 – 18:00 IST")).toBeInTheDocument();
  });

  it("has no publish checklist and no Delete draft button, but can be cancelled", async () => {
    await renderOverview(sample(DESIGN_DAY_ID));

    expect(screen.queryByText("Ready to publish?")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Delete draft" }),
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Danger zone" })).getByRole(
        "button",
        { name: "Cancel event" },
      ),
    ).toBeEnabled();
    expect(
      screen.getByRole("link", { name: "Edit event" }),
    ).toBeInTheDocument();
  });

  it("links each attention item to where it is fixed", async () => {
    await renderOverview(sample(SUMMIT_ID));

    const card = within(
      screen.getByRole("region", { name: "Needs your attention" }),
    );
    expect(
      card.getByRole("link", { name: "Open schedule board" }),
    ).toHaveAttribute("href", eventScheduleHref(SUMMIT_ID));
    expect(card.getByRole("link", { name: "Review sessions" })).toHaveAttribute(
      "href",
      eventSessionsHref(SUMMIT_ID),
    );
  });

  it("shows the quick actions switched off, marked Static", async () => {
    await renderOverview(sample(SUMMIT_ID));

    const card = within(screen.getByRole("region", { name: "Quick actions" }));
    expect(
      card.getByText("Send notification to attendees"),
    ).toBeInTheDocument();
    expect(card.getByText("Manage polls")).toBeInTheDocument();
    expect(card.getByText("View analytics")).toBeInTheDocument();
    expect(card.getByText("Static")).toBeInTheDocument();
    expect(card.queryByRole("link")).not.toBeInTheDocument();
  });
});

describe("EventOverview: cancelling a published event", () => {
  it("asks first, and keeps the event when the organizer backs out", async () => {
    const user = userEvent.setup();
    await renderOverview(sample(SUMMIT_ID));

    await user.click(screen.getByRole("button", { name: "Cancel event" }));
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByText("Cancel this event?")).toBeInTheDocument();
    await user.click(dialog.getByRole("button", { name: "Keep event" }));

    expect(api.cancel).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("cancels the event on confirm, then says it was cancelled", async () => {
    const user = userEvent.setup();
    const summit = sample(SUMMIT_ID);
    api.cancel.mockResolvedValue({
      ...summit.event,
      status: "cancelled",
    } as never);
    await renderOverview(summit);

    await user.click(screen.getByRole("button", { name: "Cancel event" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Cancel event",
      }),
    );

    expect(api.cancel).toHaveBeenCalledWith(SUMMIT_ID);
    expect(
      await screen.findByText(`${summit.event.title} was cancelled`),
    ).toBeInTheDocument();
  });

  it("shows the server's message when it cannot be cancelled", async () => {
    const user = userEvent.setup();
    api.cancel.mockRejectedValue(
      new ApiError(409, "EVENT_NOT_PUBLISHED", "A draft event is deleted"),
    );
    await renderOverview(sample(SUMMIT_ID));

    await user.click(screen.getByRole("button", { name: "Cancel event" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Cancel event",
      }),
    );

    expect(
      await screen.findByText("We couldn't cancel the event"),
    ).toBeInTheDocument();
    expect(screen.getByText("A draft event is deleted")).toBeInTheDocument();
  });
});

describe("EventOverview: the page content", () => {
  it("shows the cover with its size, and a link to replace it", async () => {
    await renderOverview(sample(SUMMIT_ID));

    const strip = within(
      await screen.findByRole("region", { name: "Cover image" }),
    );
    expect(strip.getByRole("img", { name: "Summit cover" })).toHaveAttribute(
      "src",
      "https://cms.example.com/cover.jpg",
    );
    expect(strip.getByText(/1600 × 600/)).toBeInTheDocument();
    expect(strip.getByRole("link", { name: "Replace" })).toHaveAttribute(
      "href",
      eventEditHref(SUMMIT_ID, "media"),
    );
  });

  it("says a missing cover is optional, and offers to add one", async () => {
    api.getContent.mockResolvedValue(pageContent({ coverImage: null }));
    await renderOverview(sample(SUMMIT_ID));

    const strip = within(
      await screen.findByRole("region", { name: "Cover image" }),
    );
    expect(strip.getByText(/None yet \(optional\)/)).toBeInTheDocument();
    expect(
      strip.getByRole("link", { name: "Add cover image" }),
    ).toBeInTheDocument();
  });

  it("shows the description, gallery, directions and FAQs, each marked Added", async () => {
    await renderOverview(sample(SUMMIT_ID));

    const about = within(
      await screen.findByRole("region", { name: "About this event" }),
    );
    expect(
      about.getByText("First paragraph of the description."),
    ).toBeInTheDocument();
    expect(about.getByText("Added")).toBeInTheDocument();
    expect(about.getByText("7 words")).toBeInTheDocument();

    const gallery = within(
      screen.getByRole("region", { name: "Gallery · 2 photos" }),
    );
    expect(gallery.getAllByRole("img")).toHaveLength(2);
    expect(
      gallery.getByRole("link", { name: "Manage photos" }),
    ).toHaveAttribute("href", eventEditHref(SUMMIT_ID, "media"));

    const directions = within(
      screen.getByRole("region", { name: "Venue directions" }),
    );
    expect(directions.getByText("Enter by Gate 2.")).toBeInTheDocument();

    const faqs = within(screen.getByRole("region", { name: "FAQs · 2" }));
    expect(faqs.getByText("Do I book sessions?")).toBeInTheDocument();
    expect(faqs.getByText("Yes, before the event.")).toBeInTheDocument();
  });

  it("marks the description Missing, and the gallery, directions and FAQs Optional, when empty", async () => {
    api.getContent.mockResolvedValue(
      pageContent({ about: "", venueGuide: "", faqs: [], gallery: [] }),
    );
    await renderOverview(sample(FINTECH_ID));

    const about = within(
      await screen.findByRole("region", { name: "About this event" }),
    );
    expect(about.getByText("Missing")).toBeInTheDocument();
    expect(about.getByText(/It is needed to publish/)).toBeInTheDocument();
    for (const title of [
      "Gallery · 0 photos",
      "Venue directions",
      "FAQs · 0",
    ]) {
      expect(
        within(screen.getByRole("region", { name: title })).getByText(
          "Optional",
        ),
      ).toBeInTheDocument();
    }
    expect(
      screen.getByText(
        "No photos yet. The event can be published without a gallery.",
      ),
    ).toBeInTheDocument();
  });

  it("shows a skeleton while the content loads", async () => {
    api.getContent.mockReturnValue(new Promise(() => {}));
    await renderOverview(sample(SUMMIT_ID));

    expect(
      screen.getByRole("status", { name: "Loading page content" }),
    ).toBeInTheDocument();
  });

  it("says when the content could not be loaded, keeps the figures, and tries again", async () => {
    const user = userEvent.setup();
    // The hook retries a failure twice before giving up, so every try fails until the click.
    api.getContent.mockRejectedValue(
      new ApiError(503, "CMS_UNAVAILABLE", "The CMS is down"),
    );
    await renderOverview(sample(SUMMIT_ID));

    expect(
      await screen.findByText("We couldn't load the page content"),
    ).toBeInTheDocument();
    expect(screen.getByText("The CMS is down")).toBeInTheDocument();
    // The figures above do not wait for the CMS.
    expect(screen.getByText("480 / 600")).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Cover image" }),
    ).not.toBeInTheDocument();

    api.getContent.mockResolvedValue(pageContent());
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(
      await screen.findByRole("region", { name: "About this event" }),
    ).toBeInTheDocument();
  });

  it("hides the edit links of an event that can no longer change", async () => {
    await renderOverview(sample(FUTURES_ID));

    await screen.findByRole("region", { name: "About this event" });
    expect(
      screen.queryByRole("link", { name: "Edit description" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Replace" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Manage photos" }),
    ).not.toBeInTheDocument();
  });
});

describe("EventOverview: completed and cancelled events", () => {
  it("a completed event is read-only", async () => {
    await renderOverview(sample(FUTURES_ID));

    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("This event has ended")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Edit event" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "View public page" }),
    ).toBeInTheDocument();
  });

  it("a cancelled event says so and cannot be edited", async () => {
    await renderOverview(sample(MEETUP_ID));

    expect(screen.getByText("This event is cancelled")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Edit event" }),
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Details" })).queryByRole(
        "link",
        {
          name: "Edit",
        },
      ),
    ).not.toBeInTheDocument();
  });
});
