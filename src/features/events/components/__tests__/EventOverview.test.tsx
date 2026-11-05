/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/src/core/api-client/base-api.service";
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
  eventSessionsHref,
  eventSpeakersHref,
  EVENT_ROUTES,
  publicEventHref,
} from "../../routes";
import type { EventOverviewData } from "../../types/event-manage.types";
import { EventOverview } from "../EventOverview";

jest.mock("../../api/event-api.service", () => ({
  eventApiService: {
    listMine: jest.fn(),
    countMine: jest.fn(),
    getOverview: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
}));
const api = jest.mocked(eventApiService);

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

beforeEach(() => jest.resetAllMocks());

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

  it("has no cancel or delete buttons: they have no endpoint yet", async () => {
    await renderOverview(sample(FINTECH_ID));

    expect(
      screen.queryByRole("button", { name: "Delete draft" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Cancel event" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Danger zone" }),
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

  it("has no publish checklist, no delete button and no cancel button yet", async () => {
    await renderOverview(sample(DESIGN_DAY_ID));

    expect(screen.queryByText("Ready to publish?")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Delete draft" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Cancel event" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Edit event" }),
    ).toBeInTheDocument();
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
