/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { findSampleOverview, SUMMIT_ID } from "../../__fixtures__/event-manage";
import { renderWithClient } from "../../__fixtures__/render";
import { eventApiService } from "../../api/event-api.service";
import { eventSessionNewHref } from "../../routes";
import { EventSpeakers } from "../EventSpeakers";

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

async function renderSpeakers() {
  renderWithClient(<EventSpeakers eventId={SUMMIT_ID} />);
  await screen.findByRole("heading", { level: 1 });
}

describe("EventSpeakers", () => {
  it("marks the Speakers tab as current and says the rows are sample data", async () => {
    await renderSpeakers();

    const tabs = within(
      screen.getByRole("navigation", { name: "Event sections" }),
    );
    expect(tabs.getByRole("link", { name: /Speakers/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    const notice = within(screen.getByText("Sample data").closest("div")!);
    expect(notice.getByText("Static")).toBeInTheDocument();
  });

  it("warns how many profiles are incomplete", async () => {
    await renderSpeakers();

    expect(
      screen.getByText("2 speakers have incomplete profiles."),
    ).toBeInTheDocument();
  });

  it("shows each speaker with their role, sessions and profile status", async () => {
    await renderSpeakers();

    const table = within(screen.getByRole("table"));
    expect(table.getByText("Ananya Rao")).toBeInTheDocument();
    expect(
      table.getByText("Principal Frontend Engineer, Northwind Labs"),
    ).toBeInTheDocument();
    expect(table.getAllByText("Complete").length).toBeGreaterThan(0);
  });

  it("shows the first page and pages on", async () => {
    const user = userEvent.setup();
    await renderSpeakers();

    expect(screen.getByText("Showing 1–5 of 8")).toBeInTheDocument();
    expect(screen.queryByText("Rhea Thomas")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText("Showing 6–8 of 8")).toBeInTheDocument();
    expect(screen.getByText("Rhea Thomas")).toBeInTheDocument();
    expect(screen.getByText("Not assigned to a session")).toBeInTheDocument();
  });

  it("filters by name and goes back to the first page", async () => {
    const user = userEvent.setup();
    await renderSpeakers();
    await user.click(screen.getByRole("button", { name: "Next" }));

    await user.type(
      screen.getByRole("searchbox", { name: "Search assigned speakers" }),
      "karan",
    );

    const table = within(screen.getByRole("table"));
    expect(table.getByText("Karan Iyer")).toBeInTheDocument();
    expect(table.queryByText("Ananya Rao")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1–1 of 1")).toBeInTheDocument();
  });

  it("says so when no speaker matches", async () => {
    const user = userEvent.setup();
    await renderSpeakers();

    await user.type(
      screen.getByRole("searchbox", { name: "Search assigned speakers" }),
      "zzz",
    );

    expect(screen.getByText(/No speaker matches/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("offers to assign a speaker to a session from the row menu", async () => {
    const user = userEvent.setup();
    await renderSpeakers();

    await user.click(
      screen.getByRole("button", { name: "Actions for Ananya Rao" }),
    );

    expect(
      screen.getByRole("menuitem", { name: "Assign to a session" }),
    ).toHaveAttribute("href", eventSessionNewHref(SUMMIT_ID));
  });

  it("shows the add forms switched off, marked Static", async () => {
    await renderSpeakers();

    expect(screen.getByLabelText("Full name")).toBeDisabled();
    expect(screen.getByLabelText("Email address")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add speaker" })).toBeDisabled();
    expect(
      screen.getByText("Adding speakers to an event is not built yet."),
    ).toBeInTheDocument();
  });
});
