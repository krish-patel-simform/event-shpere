/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { findSampleOverview, SUMMIT_ID } from "../../__fixtures__/event-manage";
import { renderWithClient } from "../../__fixtures__/render";
import { eventApiService } from "../../api/event-api.service";
import { EventAttendees } from "../EventAttendees";

jest.mock("../../api/event-api.service", () => ({
  eventApiService: { getOverview: jest.fn() },
}));
const api = jest.mocked(eventApiService);

beforeEach(() => {
  jest.resetAllMocks();
  const overview = findSampleOverview(SUMMIT_ID);
  if (!overview) throw new Error("no sample overview");
  api.getOverview.mockResolvedValue(overview);
});

async function renderAttendees() {
  renderWithClient(<EventAttendees eventId={SUMMIT_ID} />);
  await screen.findByRole("heading", { level: 1 });
}

const searchBox = () =>
  screen.getByRole("searchbox", {
    name: "Search attendees by name or email",
  });

describe("EventAttendees", () => {
  it("marks the Attendees tab as current and says the rows are sample data", async () => {
    await renderAttendees();

    const tabs = within(
      screen.getByRole("navigation", { name: "Event sections" }),
    );
    expect(tabs.getByRole("link", { name: /Attendees/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    const notice = within(screen.getByText("Sample data").closest("div")!);
    expect(notice.getByText("Static")).toBeInTheDocument();
  });

  it("shows the four totals", async () => {
    await renderAttendees();

    // The tab count in the header also says 480, so read each total inside its own card.
    const card = (label: string) =>
      within(screen.getByText(label, { selector: "p" }).parentElement!);

    expect(card("Registered").getByText("480")).toBeInTheDocument();
    expect(card("Registered").getByText("of 600 seats")).toBeInTheDocument();
    expect(card("Cancelled").getByText("17")).toBeInTheDocument();
    expect(card("Session bookings").getByText("1,286")).toBeInTheDocument();
    expect(
      card("Session bookings").getByText("average 2.7 per attendee"),
    ).toBeInTheDocument();
    expect(
      card("Checked in").getByText("check-in is not built yet"),
    ).toBeInTheDocument();
  });

  it("lists each attendee with email, date, sessions booked and status", async () => {
    await renderAttendees();

    const rows = within(screen.getByRole("table")).getAllByRole("row");
    const rahul = within(rows[1]);
    expect(rahul.getByText("Rahul Sharma")).toBeInTheDocument();
    expect(rahul.getByText("rahul.sharma@example.com")).toBeInTheDocument();
    expect(rahul.getByText("12 Oct 2026")).toBeInTheDocument();
    expect(rahul.getByText("3")).toBeInTheDocument();
    expect(rahul.getByText("Registered")).toBeInTheDocument();
    // Amit Verma booked nothing.
    expect(within(rows[3]).getByText("None")).toBeInTheDocument();
  });

  it("shows the first page and pages on", async () => {
    const user = userEvent.setup();
    await renderAttendees();

    expect(screen.getByText("Showing 1–6 of 10")).toBeInTheDocument();
    expect(screen.queryByText("Kabir Singh")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText("Showing 7–10 of 10")).toBeInTheDocument();
    expect(screen.getByText("Kabir Singh")).toBeInTheDocument();
  });

  it("searches by name or email and starts again from the first page", async () => {
    const user = userEvent.setup();
    await renderAttendees();
    await user.click(screen.getByRole("button", { name: "Next" }));

    await user.type(searchBox(), "isha.patil");

    expect(screen.getByText("Isha Patil")).toBeInTheDocument();
    expect(screen.queryByText("Rahul Sharma")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1–1 of 1")).toBeInTheDocument();
  });

  it("filters by status", async () => {
    const user = userEvent.setup();
    await renderAttendees();

    await user.selectOptions(screen.getByLabelText("Status"), "cancelled");

    const table = within(screen.getByRole("table"));
    expect(table.getByText("Sandeep Kulkarni")).toBeInTheDocument();
    expect(table.getByText("Lata Deshmukh")).toBeInTheDocument();
    expect(table.queryByText("Rahul Sharma")).not.toBeInTheDocument();
  });

  it("filters by session and says how many registrations include it", async () => {
    const user = userEvent.setup();
    await renderAttendees();

    await user.selectOptions(
      screen.getByLabelText("Session"),
      "Observability for Frontend Teams",
    );

    const table = within(screen.getByRole("table"));
    expect(table.getByText("Divya Menon")).toBeInTheDocument();
    expect(table.getByText("Lata Deshmukh")).toBeInTheDocument();
    expect(table.queryByText("Rahul Sharma")).not.toBeInTheDocument();
    expect(
      screen.getByText(/2 registrations include “Observability/),
    ).toBeInTheDocument();
  });

  it("does not offer a cancelled session in the session filter", async () => {
    await renderAttendees();

    expect(
      within(screen.getByLabelText("Session")).queryByText(
        "Micro-frontends in Practice",
      ),
    ).not.toBeInTheDocument();
  });

  it("says no one matches, and clears every filter", async () => {
    const user = userEvent.setup();
    await renderAttendees();

    await user.type(searchBox(), "zzz");

    expect(
      screen.getByText("No attendee matches these filters."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Clear search and filters" }),
    );

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(searchBox()).toHaveValue("");
  });

  it("shows Export CSV switched off, marked Static", async () => {
    await renderAttendees();

    expect(screen.getByRole("button", { name: "Export CSV" })).toBeDisabled();
  });
});
