/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import { EMPTY_ATTENDEE_HOME } from "../../../__fixtures__/home-empty";
import { HOME_SAMPLE_NOW } from "../../../utils/home-sample-now";
import { AttendeeHome } from "../AttendeeHome";

/** The KPI card with this label (label and number are siblings in one box). */
function kpi(label: string) {
  const card = screen.getByText(label).parentElement;
  if (!card) throw new Error(`No KPI card for ${label}`);
  return card;
}

describe("AttendeeHome with the sample data", () => {
  beforeEach(() => render(<AttendeeHome now={HOME_SAMPLE_NOW} />));

  it("greets the attendee by their next event, with a countdown", () => {
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Hi Rahul, Product Engineering Summit is coming up",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Thu 3 – Sat 5 Dec/)).toBeInTheDocument();
    expect(screen.getByText("3 sessions booked")).toBeInTheDocument();
    expect(
      screen.getByRole("timer", {
        name: "43 days, 18 hours, 30 minutes until your next event",
      }),
    ).toBeInTheDocument();
  });

  it("shows the four numbers", () => {
    expect(kpi("Upcoming events")).toHaveTextContent("2");
    expect(kpi("Sessions booked")).toHaveTextContent("5");
    expect(kpi("Sessions to rate")).toHaveTextContent("1");
    expect(kpi("Polls voted")).toHaveTextContent("4");
  });

  it("lists the registered events and marks the cancelled one", () => {
    expect(
      screen.getByRole("heading", { level: 2, name: "My events" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("3–5 Dec · Pune · Free · 3 sessions booked"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("14 Nov · Pune · ₹1,500 · 2 sessions booked"),
    ).toBeInTheDocument();
    expect(screen.getByText("Event cancelled")).toBeInTheDocument();
    expect(
      screen.getByText(/Cancelled by the organizer on 18 Oct\./),
    ).toBeInTheDocument();
    // A cancelled event has no link and no Manage button.
    expect(
      screen.queryByRole("link", { name: /Frontend Meetup/ }),
    ).not.toBeInTheDocument();
  });

  it("shows the booked sessions of the day, with the free time between them", () => {
    expect(
      screen.getByRole("heading", { level: 2, name: "My schedule" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Product Engineering Summit · Fri 4 Dec"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("10:00 – 10:45 · Scaling Next.js Applications"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("10:45 – 11:30 · Free time · coffee in the foyer"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Booked")).toHaveLength(2);
  });

  it("shows the rating prompt and the notifications with relative times", () => {
    expect(
      screen.getByRole("heading", { level: 2, name: "Rate your session" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Accessibility Basics")).toBeInTheDocument();
    expect(screen.getByText("1 hour ago")).toBeInTheDocument();
    expect(screen.getByText("2 days ago")).toBeInTheDocument();
    // Two of the three are unread.
    expect(screen.getAllByText(/Unread:/)).toHaveLength(2);
  });

  it("links to the final paths", () => {
    const href = (name: string) =>
      screen.getByRole("link", { name }).getAttribute("href");

    expect(href("View event")).toBe("/events/product-engineering-summit-2026");
    expect(href("Browse more events")).toBe("/events");
    expect(href("Browse events")).toBe("/events");
    expect(href("Product Engineering Summit 2026")).toBe(
      "/events/product-engineering-summit-2026",
    );
    expect(href("Manage Design Systems Engineering Day")).toBe(
      "/events/design-systems-engineering-day",
    );
    expect(href("Full schedule")).toBe("/my-schedule");
    expect(href("My schedule")).toBe("/my-schedule");
    expect(href("Ananya Rao")).toBe("/speakers/ananya-rao");
    expect(href("See all")).toBe("/notifications");
    expect(href("Become an organizer")).toBe("/signup/organizer");
    expect(href("Give feedback")).toBe("/my-schedule");
  });

  it("has one h1 and the sections under it in order", () => {
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const names = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);
    expect(names).toEqual([
      "My events",
      "My schedule",
      "Rate your session",
      "Notifications",
      "Want to run your own events?",
    ]);
  });
});

describe("AttendeeHome with no data", () => {
  beforeEach(() =>
    render(<AttendeeHome data={EMPTY_ATTENDEE_HOME} now={HOME_SAMPLE_NOW} />),
  );

  it("each section says what is missing", () => {
    expect(screen.getByText(/No upcoming events/)).toBeInTheDocument();
    expect(screen.getByText(/No sessions booked yet/)).toBeInTheDocument();
    expect(
      screen.getByText("No sessions to rate right now."),
    ).toBeInTheDocument();
    expect(screen.getByText("No notifications yet.")).toBeInTheDocument();
  });

  it("the banner asks the attendee to find an event, without a countdown", () => {
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Hi Rahul, find your next event",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();
    expect(
      within(
        screen.getByRole("region", { name: /find your next event/ }),
      ).getByRole("link", { name: "Browse events" }),
    ).toHaveAttribute("href", "/events");
  });

  it("the numbers are zero", () => {
    expect(kpi("Upcoming events")).toHaveTextContent("0");
    expect(kpi("Polls voted")).toHaveTextContent("0");
  });
});

describe("AttendeeHome once the event has started", () => {
  it("no countdown after the start time", () => {
    render(<AttendeeHome now="2026-12-04T00:00:00Z" />);
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();
  });
});
