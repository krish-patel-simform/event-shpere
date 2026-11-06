/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { venueApiService } from "@/src/features/venues/api/venue-api.service";
import {
  FUTURES_ID,
  FINTECH_ID,
  findSampleOverview,
} from "../../../events/__fixtures__/event-manage";
import { eventApiService } from "../../../events/api/event-api.service";
import {
  eventEditHref,
  eventScheduleHref,
  eventSessionsHref,
} from "../../../events";
import {
  cancelledKeynote,
  HALL_A_ID,
  HALL_B_ID,
  talk,
  workshop,
} from "../../__fixtures__/organizer-sessions";
import { renderWithClient } from "../../__fixtures__/render";
import { sessionApiService } from "../../api/session-api.service";
import { EventHalls } from "../EventHalls";

jest.mock("../../../events/api/event-api.service", () => ({
  eventApiService: { getOverview: jest.fn() },
}));
jest.mock("../../api/session-api.service", () => ({
  sessionApiService: { listForEvent: jest.fn() },
}));
jest.mock("@/src/features/venues/api/venue-api.service", () => ({
  venueApiService: { get: jest.fn() },
}));

const events = jest.mocked(eventApiService);
const sessionsApi = jest.mocked(sessionApiService);
const venues = jest.mocked(venueApiService);

const venueDetail = (halls: readonly object[] = defaultHalls) =>
  ({
    id: "7a1f0c52-3d84-4b6e-9a21-5c8e0f1b2d02",
    name: "Hotel Orchid",
    addressLine: "Plot 12, Baner Road",
    city: "Pune",
    state: "Maharashtra",
    stateId: null,
    postalCode: null,
    country: "IN",
    timezone: "Asia/Kolkata",
    latitude: null,
    longitude: null,
    isActive: true,
    halls,
  }) as never;

const defaultHalls = [
  {
    id: HALL_B_ID,
    name: "Hall B",
    capacity: 120,
    sortOrder: 2,
    isActive: true,
  },
  {
    id: HALL_A_ID,
    name: "Hall A",
    capacity: 300,
    sortOrder: 1,
    isActive: true,
  },
];

function overviewOf(id: string) {
  const overview = findSampleOverview(id);
  if (!overview) throw new Error(`no sample overview ${id}`);
  return overview;
}

beforeEach(() => {
  jest.resetAllMocks();
  events.getOverview.mockResolvedValue(overviewOf(FINTECH_ID));
  venues.get.mockResolvedValue(venueDetail());
  sessionsApi.listForEvent.mockResolvedValue([
    talk,
    { ...workshop, hallId: HALL_A_ID },
    { ...cancelledKeynote, hallId: HALL_B_ID },
  ]);
});

async function renderHalls(eventId = FINTECH_ID) {
  renderWithClient(<EventHalls eventId={eventId} />);
  await screen.findByRole("heading", { level: 1 });
}

describe("EventHalls", () => {
  it("marks the Halls tab as current", async () => {
    await renderHalls();

    const tabs = within(
      screen.getByRole("navigation", { name: "Event sections" }),
    );
    expect(tabs.getByRole("link", { name: /Halls/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("asks the venue of the event for its halls", async () => {
    await renderHalls();
    await screen.findByRole("table");

    const venueId = overviewOf(FINTECH_ID).event.venue?.id;
    expect(venues.get).toHaveBeenCalledWith(venueId);
  });

  it("shows a skeleton while the halls load", async () => {
    venues.get.mockReturnValue(new Promise(() => {}));
    await renderHalls();

    expect(
      await screen.findByRole("status", { name: "Loading halls" }),
    ).toBeInTheDocument();
  });

  it("names the venue the halls belong to", async () => {
    await renderHalls();

    expect(
      await screen.findByRole("heading", {
        name: "Halls at Hotel Orchid, Pune",
      }),
    ).toBeInTheDocument();
  });

  it("lists the halls in the venue's order, with seats, status and this event's sessions", async () => {
    await renderHalls();

    const rows = within(await screen.findByRole("table")).getAllByRole("row");
    // The header row, then one row per hall: Hall A (order 1) before Hall B (order 2).
    expect(rows).toHaveLength(3);
    const hallA = within(rows[1]);
    expect(hallA.getByText("1")).toBeInTheDocument();
    expect(hallA.getByText("Hall A")).toBeInTheDocument();
    expect(hallA.getByText("300")).toBeInTheDocument();
    expect(hallA.getByText("Active")).toBeInTheDocument();
    expect(await hallA.findByText("2 sessions")).toBeInTheDocument();
    expect(
      await within(rows[2]).findByText("1 session · 1 cancelled"),
    ).toBeInTheDocument();
  });

  it("marks a hall that is inactive", async () => {
    venues.get.mockResolvedValue(
      venueDetail([{ ...defaultHalls[1], isActive: false }]),
    );
    await renderHalls();

    expect(await screen.findByText("Inactive")).toBeInTheDocument();
  });

  it("still lists the halls when the session counts cannot load, and offers to try again", async () => {
    const user = userEvent.setup();
    sessionsApi.listForEvent.mockRejectedValue(
      new ApiError(503, "UNAVAILABLE", "down"),
    );
    await renderHalls();

    expect(await screen.findByText("Hall A")).toBeInTheDocument();
    expect(
      await screen.findByText("The session counts could not be loaded."),
    ).toBeInTheDocument();

    sessionsApi.listForEvent.mockResolvedValue([talk]);
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("1 session")).toBeInTheDocument();
  });

  it("says so when the venue has no halls yet", async () => {
    venues.get.mockResolvedValue(venueDetail([]));
    await renderHalls();

    expect(
      await screen.findByText(/This venue has no halls yet/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows the server's message when the halls cannot load, and tries again", async () => {
    const user = userEvent.setup();
    venues.get.mockRejectedValueOnce(
      new ApiError(503, "UNAVAILABLE", "Try again in a moment"),
    );
    await renderHalls();

    expect(
      await screen.findByText("We couldn't load the halls"),
    ).toBeInTheDocument();
    expect(screen.getByText("Try again in a moment")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Hall A")).toBeInTheDocument();
  });

  it("links a hall to the schedule board and to the sessions", async () => {
    const user = userEvent.setup();
    await renderHalls();

    await user.click(
      await screen.findByRole("button", { name: "Actions for Hall A" }),
    );

    expect(
      screen.getByRole("menuitem", { name: "View on schedule board" }),
    ).toHaveAttribute("href", eventScheduleHref(FINTECH_ID));
    expect(
      screen.getByRole("menuitem", { name: "See sessions in this hall" }),
    ).toHaveAttribute("href", eventSessionsHref(FINTECH_ID));
  });

  it("explains that halls belong to the venue, and offers to change the venue", async () => {
    await renderHalls();

    expect(
      screen.getByText(/Halls belong to the venue, not to the event/),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Change venue" })).toHaveAttribute(
      "href",
      eventEditHref(FINTECH_ID),
    );
  });

  it("does not offer to change the venue of an event that can no longer change", async () => {
    events.getOverview.mockResolvedValue(overviewOf(FUTURES_ID));
    await renderHalls(FUTURES_ID);

    expect(
      screen.queryByRole("link", { name: "Change venue" }),
    ).not.toBeInTheDocument();
  });

  it("says when the event has no venue yet, without asking for halls", async () => {
    const draft = overviewOf(FINTECH_ID);
    events.getOverview.mockResolvedValue({
      ...draft,
      event: { ...draft.event, venue: null },
    });
    await renderHalls();

    expect(screen.getByText("This event has no venue yet")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Choose a venue" }),
    ).toHaveAttribute("href", eventEditHref(FINTECH_ID));
    expect(venues.get).not.toHaveBeenCalled();
  });
});
