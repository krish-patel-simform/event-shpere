/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  FUTURES_ID,
  findSampleOverview,
  SUMMIT_ID,
} from "../../__fixtures__/event-manage";
import { renderWithClient } from "../../__fixtures__/render";
import { eventApiService } from "../../api/event-api.service";
import {
  eventEditHref,
  eventScheduleHref,
  eventSessionsHref,
} from "../../routes";
import { EventHalls } from "../EventHalls";

jest.mock("../../api/event-api.service", () => ({
  eventApiService: { getOverview: jest.fn() },
}));
const api = jest.mocked(eventApiService);

function answerWith(id: string) {
  const overview = findSampleOverview(id);
  if (!overview) throw new Error(`no sample overview ${id}`);
  api.getOverview.mockResolvedValue(overview);
  return overview;
}

beforeEach(() => {
  jest.resetAllMocks();
  answerWith(SUMMIT_ID);
});

async function renderHalls(eventId = SUMMIT_ID) {
  renderWithClient(<EventHalls eventId={eventId} />);
  await screen.findByRole("heading", { level: 1 });
}

describe("EventHalls", () => {
  it("marks the Halls tab as current and says the rows are sample data", async () => {
    await renderHalls();

    const tabs = within(
      screen.getByRole("navigation", { name: "Event sections" }),
    );
    expect(tabs.getByRole("link", { name: /Halls/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    const notice = within(screen.getByText("Sample data").closest("div")!);
    expect(notice.getByText("Static")).toBeInTheDocument();
  });

  it("names the venue the halls belong to", async () => {
    await renderHalls();

    expect(
      screen.getByRole("heading", { name: "Halls at Convention Centre, Pune" }),
    ).toBeInTheDocument();
  });

  it("lists every hall with its order, seats, sessions and status", async () => {
    await renderHalls();

    const rows = within(screen.getByRole("table")).getAllByRole("row");
    // The header row, then one row per hall.
    expect(rows).toHaveLength(5);
    const hallB = within(rows[3]);
    expect(hallB.getByText("3")).toBeInTheDocument();
    expect(hallB.getByText("Hall B")).toBeInTheDocument();
    expect(hallB.getByText("300")).toBeInTheDocument();
    expect(hallB.getByText("4 sessions · 1 cancelled")).toBeInTheDocument();
    expect(hallB.getByText("Active")).toBeInTheDocument();
  });

  it("links a hall to the schedule board and to the sessions", async () => {
    const user = userEvent.setup();
    await renderHalls();

    await user.click(screen.getByRole("button", { name: "Actions for Lab 3" }));

    expect(
      screen.getByRole("menuitem", { name: "View on schedule board" }),
    ).toHaveAttribute("href", eventScheduleHref(SUMMIT_ID));
    expect(
      screen.getByRole("menuitem", { name: "See sessions in this hall" }),
    ).toHaveAttribute("href", eventSessionsHref(SUMMIT_ID));
  });

  it("explains that halls belong to the venue, and offers to change the venue", async () => {
    await renderHalls();

    expect(
      screen.getByText(/Halls belong to the venue, not to the event/),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Change venue" })).toHaveAttribute(
      "href",
      eventEditHref(SUMMIT_ID),
    );
  });

  it("does not offer to change the venue of an event that can no longer change", async () => {
    const overview = answerWith(FUTURES_ID);
    expect(["completed", "cancelled"]).toContain(overview.event.status);

    await renderHalls(FUTURES_ID);

    expect(
      screen.queryByRole("link", { name: "Change venue" }),
    ).not.toBeInTheDocument();
  });

  it("says reordering is not built yet instead of offering it", async () => {
    await renderHalls();

    expect(
      screen.getByText("Reordering halls is not built yet."),
    ).toBeInTheDocument();
  });
});
