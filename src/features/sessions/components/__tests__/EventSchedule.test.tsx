/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { venueApiService } from "@/src/features/venues/api/venue-api.service";
import {
  FINTECH_ID,
  findSampleOverview,
  FUTURES_ID,
} from "../../../events/__fixtures__/event-manage";
import { eventApiService } from "../../../events/api/event-api.service";
import { eventEditHref } from "../../../events";
import {
  cancelledKeynote,
  HALL_A_ID,
  HALL_B_ID,
  talk,
  workshop,
} from "../../__fixtures__/organizer-sessions";
import { renderWithClient } from "../../__fixtures__/render";
import { sessionApiService } from "../../api/session-api.service";
import { eventSessionEditHref, eventSessionNewHref } from "../../routes";
import { EventSchedule } from "../EventSchedule";

jest.mock("../../../events/api/event-api.service", () => ({
  eventApiService: { getOverview: jest.fn() },
}));
jest.mock("../../api/session-api.service", () => ({
  sessionApiService: { listForEvent: jest.fn(), update: jest.fn() },
}));
jest.mock("@/src/features/venues/api/venue-api.service", () => ({
  venueApiService: { get: jest.fn() },
}));

const events = jest.mocked(eventApiService);
const sessionsApi = jest.mocked(sessionApiService);
const venues = jest.mocked(venueApiService);

const halls = [
  // Listed out of order: the board follows sortOrder.
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

const venueDetail = (hallList: readonly object[] = halls) =>
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
    halls: hallList,
  }) as never;

function overviewOf(id: string) {
  const overview = findSampleOverview(id);
  if (!overview) throw new Error(`no sample overview ${id}`);
  return overview;
}

// The talk is in Hall A 10:00–11:00 IST on 12 Dec 2026, the workshop in Hall B 12:00–14:00.
const talkInHallA = talk;
const workshopInHallB = { ...workshop, status: "scheduled" as const };
const cancelledInHallB = {
  ...talk,
  id: "7c3d4e5f-6a7b-4c8d-ae9f-1a2b3c4d5e99",
  title: "Cancelled Panel",
  status: "cancelled" as const,
  hallId: HALL_B_ID,
  startAt: "2026-12-12T08:30:00.000Z",
  endAt: "2026-12-12T09:30:00.000Z",
  speakers: [],
};

beforeEach(() => {
  jest.resetAllMocks();
  events.getOverview.mockResolvedValue(overviewOf(FINTECH_ID));
  venues.get.mockResolvedValue(venueDetail());
  sessionsApi.listForEvent.mockResolvedValue([
    talkInHallA,
    workshopInHallB,
    cancelledInHallB,
    cancelledKeynote,
  ]);
});

async function renderSchedule() {
  renderWithClient(<EventSchedule eventId={FINTECH_ID} />);
  await screen.findByRole("region", { name: /Schedule board/ });
}

describe("EventSchedule", () => {
  it("shows the event's header with the Schedule board tab as current", async () => {
    await renderSchedule();

    const tabs = within(
      screen.getByRole("navigation", { name: "Event sections" }),
    );
    expect(tabs.getByRole("link", { name: /Schedule board/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("shows a skeleton while the event, the halls and the sessions load", async () => {
    renderWithClient(<EventSchedule eventId={FINTECH_ID} />);

    expect(
      await screen.findByRole("status", { name: "Loading event" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("status", { name: "Loading the schedule" }),
    ).toBeInTheDocument();
    await screen.findByRole("region", { name: /Schedule board/ });
  });

  it("asks the server for the event's own sessions and its venue's halls", async () => {
    await renderSchedule();

    expect(sessionsApi.listForEvent).toHaveBeenCalledWith(FINTECH_ID);
    expect(venues.get).toHaveBeenCalledWith(
      overviewOf(FINTECH_ID).event.venue?.id,
    );
  });

  it("draws one column per hall in the venue's order, each with its own sessions", async () => {
    await renderSchedule();

    const columns = screen.getAllByRole("list", { name: /, Sat 12 Dec$/ });
    expect(columns.map((column) => column.getAttribute("aria-label"))).toEqual([
      "Hall A, Sat 12 Dec",
      "Hall B, Sat 12 Dec",
    ]);

    const hallA = within(columns[0]);
    expect(hallA.getByText("Offline-first Event Apps")).toBeInTheDocument();
    expect(hallA.getByText(/10:00–11:00 · Ananya Rao/)).toBeInTheDocument();
    expect(
      hallA.queryByText("Design Systems in Practice"),
    ).not.toBeInTheDocument();

    const hallB = within(columns[1]);
    expect(hallB.getByText("Design Systems in Practice")).toBeInTheDocument();
    expect(
      hallB.getByText(/12:00–14:00 · Ananya Rao, Rohan Mehta/),
    ).toBeInTheDocument();
  });

  it("shows a cancelled session struck through and marked", async () => {
    await renderSchedule();

    const hallB = within(
      screen.getByRole("list", { name: "Hall B, Sat 12 Dec" }),
    );
    expect(hallB.getByText("Cancelled Panel")).toHaveClass("line-through");
    expect(hallB.getByText(/Cancelled$/)).toBeInTheDocument();
  });

  it("gives every session that can be moved a grip, and a cancelled one none", async () => {
    await renderSchedule();

    expect(
      screen.getByRole("button", { name: "Move Offline-first Event Apps" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Move Design Systems in Practice" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Move Cancelled Panel" }),
    ).not.toBeInTheDocument();
  });

  it("lists a session without a hall above the board, marked cancelled, with a way to open it", async () => {
    await renderSchedule();

    const heading = screen.getByRole("heading", {
      name: "Not on the board (1)",
    });
    const card = within(heading.closest("section")!);
    // The online keynote is cancelled: struck through and marked, as on the board.
    expect(card.getByText(cancelledKeynote.title)).toHaveClass("line-through");
    expect(card.getByText("Cancelled")).toBeInTheDocument();
    // When it was to take place, in the event's zone (09:00 IST).
    expect(card.getByText("Fri 11 Dec · 09:00–10:00")).toBeInTheDocument();
    expect(
      card.getByRole("link", { name: `Edit ${cancelledKeynote.title}` }),
    ).toHaveAttribute(
      "href",
      eventSessionEditHref(FINTECH_ID, cancelledKeynote.id),
    );

    // It comes before the board, not after it.
    const board = screen.getByRole("heading", { name: "Schedule" });
    expect(
      heading.compareDocumentPosition(board) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("opens a session's edit page from a click on its block", async () => {
    await renderSchedule();

    expect(
      screen.getByRole("link", { name: "Edit Offline-first Event Apps" }),
    ).toHaveAttribute("href", eventSessionEditHref(FINTECH_ID, talkInHallA.id));
    expect(
      screen.getByRole("link", { name: "Edit Design Systems in Practice" }),
    ).toHaveAttribute(
      "href",
      eventSessionEditHref(FINTECH_ID, workshopInHallB.id),
    );
  });

  it("has a way to create a session", async () => {
    await renderSchedule();

    expect(
      screen.getByRole("link", { name: "Create session" }),
    ).toHaveAttribute("href", eventSessionNewHref(FINTECH_ID));
  });

  it("tells that nothing is placed on a day without sessions", async () => {
    sessionsApi.listForEvent.mockResolvedValue([]);
    await renderSchedule();

    expect(
      screen.getByText("Nothing is placed on Sat 12 Dec yet."),
    ).toBeInTheDocument();
  });

  it("marks an inactive hall", async () => {
    venues.get.mockResolvedValue(
      venueDetail([{ ...halls[1], isActive: false }, halls[0]]),
    );
    await renderSchedule();

    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });
});

describe("EventSchedule: when it can not be shown or changed", () => {
  it("says so and offers no way to move a session in a completed event", async () => {
    events.getOverview.mockResolvedValue(overviewOf(FUTURES_ID));
    renderWithClient(<EventSchedule eventId={FUTURES_ID} />);

    expect(
      await screen.findByText(
        /can no longer be changed, so its sessions can.t be moved/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Move / }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Create session" }),
    ).not.toBeInTheDocument();
  });

  it("asks for a venue when the event has none", async () => {
    const overview = overviewOf(FINTECH_ID);
    events.getOverview.mockResolvedValue({
      ...overview,
      event: { ...overview.event, venue: null },
    });
    renderWithClient(<EventSchedule eventId={FINTECH_ID} />);

    expect(
      await screen.findByText("This event has no venue yet"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Choose a venue" }),
    ).toHaveAttribute("href", eventEditHref(FINTECH_ID));
    expect(venues.get).not.toHaveBeenCalled();
  });

  it("says so when the venue has no halls", async () => {
    venues.get.mockResolvedValue(venueDetail([]));
    renderWithClient(<EventSchedule eventId={FINTECH_ID} />);

    expect(
      await screen.findByText("This venue has no halls yet"),
    ).toBeInTheDocument();
  });

  it("shows why the sessions could not be loaded, and tries again on request", async () => {
    const user = userEvent.setup();
    // Every try fails (a failed load is tried again before it is given up on).
    sessionsApi.listForEvent.mockRejectedValue(
      new ApiError(500, "SERVER_ERROR", "The server is down"),
    );
    renderWithClient(<EventSchedule eventId={FINTECH_ID} />);

    expect(
      await screen.findByText("We couldn't load the schedule"),
    ).toBeInTheDocument();
    expect(screen.getByText("The server is down")).toBeInTheDocument();

    sessionsApi.listForEvent.mockResolvedValue([talkInHallA]);
    await user.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() =>
      expect(
        screen.getByRole("region", { name: /Schedule board/ }),
      ).toBeInTheDocument(),
    );
  });
});
