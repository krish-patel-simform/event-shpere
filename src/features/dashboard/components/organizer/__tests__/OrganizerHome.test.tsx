/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import { EMPTY_ORGANIZER_HOME } from "../../../__fixtures__/home-empty";
import { OrganizerHome } from "../OrganizerHome";

// ECharts needs a canvas (tested on its own in core/charts): a stand-in with the same name.
jest.mock("@/src/core/charts/EChart", () => ({
  EChart: ({ ariaLabel }: { ariaLabel: string }) => (
    <div role="img" aria-label={ariaLabel} />
  ),
}));

/** The KPI card with this label (label and number are siblings in one box). */
function kpi(label: string) {
  const card = screen.getByText(label).parentElement;
  if (!card) throw new Error(`No KPI card for ${label}`);
  return card;
}

describe("OrganizerHome with the sample data", () => {
  beforeEach(() => render(<OrganizerHome />));

  it("has the heading and the create-event link", () => {
    expect(
      screen.getByRole("heading", { level: 1, name: "Organizer dashboard" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create event" })).toHaveAttribute(
      "href",
      "/events/new",
    );
  });

  it("shows the four numbers with their notes", () => {
    expect(kpi("Published events")).toHaveTextContent("2");
    expect(kpi("Published events")).toHaveTextContent("1 draft · 1 completed");
    expect(kpi("Event registrations")).toHaveTextContent("1,284");
    expect(kpi("Event registrations")).toHaveTextContent("▲ 96 this week");
    expect(kpi("Seats filled")).toHaveTextContent("68%");
    expect(kpi("Avg. session rating")).toHaveTextContent("4.4 / 5");
  });

  it("draws the registrations chart after its skeleton, with a text alternative", async () => {
    expect(
      screen.getByRole("heading", { level: 2, name: "Registrations per day" }),
    ).toBeInTheDocument();
    expect(screen.getByText("▲ 18% vs previous 14 days")).toBeInTheDocument();
    expect(
      await screen.findByRole("img", {
        name: "Daily registrations from 7 Oct to 20 Oct, ranging from 58 to 162 per day, peaking on 19 Oct.",
      }),
    ).toBeInTheDocument();
  });

  it("has the exact numbers in a table hidden by a wrapping div, not by the table itself", () => {
    const table = screen.getByRole("table", { name: "Registrations per day" });
    expect(table).not.toHaveClass("sr-only");
    expect(table.parentElement).toHaveClass("sr-only");
    expect(screen.getByRole("row", { name: /19 Oct/ })).toHaveTextContent(
      "162",
    );
  });

  it("shows what the draft still needs before it can be published", () => {
    const card = screen.getByRole("region", { name: "Ready to publish?" });
    expect(card).toHaveTextContent("Data Engineering Conference 2027");
    expect(screen.getByText("3 / 5")).toBeInTheDocument();
    expect(
      screen.getByText("Description and banner missing"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Missing: Event content in the CMS, All sessions scheduled",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Publish event" }),
    ).toBeDisabled();
    expect(screen.getByRole("link", { name: "Edit content" })).toHaveAttribute(
      "href",
      "/events/data-engineering-conference-2027",
    );
  });

  it("lists the events with status, seats and a link to each", () => {
    const table = screen.getByRole("table", { name: "Your events" });
    expect(within(table).getAllByRole("row")).toHaveLength(6);
    expect(
      within(table).getByText("3–5 Dec · Pune · Free"),
    ).toBeInTheDocument();
    expect(
      within(table).getByText("9–10 Jan · Pune · ₹2,500"),
    ).toBeInTheDocument();
    expect(within(table).getByText("180 / 300")).toBeInTheDocument();
    expect(within(table).getByText("138 / 150")).toBeInTheDocument();
    expect(within(table).getByText("Not open yet")).toBeInTheDocument();
    expect(within(table).getByText("64 notified")).toBeInTheDocument();
    expect(within(table).getByText("412 attended")).toBeInTheDocument();
    for (const status of ["Published", "Draft", "Cancelled", "Completed"]) {
      expect(within(table).getAllByText(status).length).toBeGreaterThan(0);
    }
    expect(
      screen.getByRole("link", {
        name: "Manage Product Engineering Summit 2026",
      }),
    ).toHaveAttribute("href", "/events/product-engineering-summit-2026");
    expect(
      screen.getByRole("link", {
        name: "Continue Data Engineering Conference 2027",
      }),
    ).toHaveAttribute("href", "/events/data-engineering-conference-2027");
    expect(
      screen.getByRole("link", { name: "Analytics Frontend Day 2025" }),
    ).toHaveAttribute("href", "/events/frontend-day-2025");
    expect(screen.getByRole("link", { name: "View all" })).toHaveAttribute(
      "href",
      "/events",
    );
  });

  it("lists what needs attention", () => {
    expect(
      screen.getByRole("heading", { level: 2, name: "Needs attention" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Almost full")).toBeInTheDocument();
    expect(screen.getByText("Type-safe APIs workshop")).toBeInTheDocument();
    expect(screen.getByText("Priya Kulkarni")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Send invite" })).toHaveAttribute(
      "href",
      "/speakers",
    );
    expect(screen.getByRole("link", { name: "Retry" })).toBeInTheDocument();
    expect(
      screen.getByText(/3 draft polls are ready for the Thu 4 Dec sessions/),
    ).toBeInTheDocument();
  });

  it("has one h1", () => {
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });
});

describe("OrganizerHome with no data", () => {
  beforeEach(() => render(<OrganizerHome data={EMPTY_ORGANIZER_HOME} />));

  it("each section says what is missing", () => {
    expect(
      screen.getByText("No registrations in this period."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("No drafts waiting to be published."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("No events yet. Create your first event."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Nothing needs your attention right now."),
    ).toBeInTheDocument();
  });

  it("draws no chart and no table", () => {
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("the numbers are zero or a dash", () => {
    expect(kpi("Published events")).toHaveTextContent("0");
    expect(kpi("Avg. session rating")).toHaveTextContent("–");
    expect(kpi("Avg. session rating")).toHaveTextContent("No ratings yet");
  });
});
