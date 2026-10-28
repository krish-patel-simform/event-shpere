/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import { EMPTY_SPEAKER_HOME } from "../../../__fixtures__/home-empty";
import { HOME_SAMPLE_NOW } from "../../../utils/home-sample-now";
import { SpeakerHome } from "../SpeakerHome";

const SESSION_ID = "e3b1c9d0-7a52-4f1e-8c34-5b2a9d6f0a01";

/** The KPI card with this label (label and number are siblings in one box). */
function kpi(label: string) {
  const card = screen.getByText(label).parentElement;
  if (!card) throw new Error(`No KPI card for ${label}`);
  return card;
}

describe("SpeakerHome with the sample data", () => {
  beforeEach(() => render(<SpeakerHome now={HOME_SAMPLE_NOW} />));

  it("greets the speaker and counts down to the next session", () => {
    expect(screen.getByText("Tuesday, 20 October 2026")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Welcome back, Ananya" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Fri 4 Dec, 10:00 IST · Hall B, Level 2/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("timer", {
        name: "44 days, 19 hours, 30 minutes until your next session",
      }),
    ).toBeInTheDocument();
    // The seats meter in the banner (the sessions list repeats the number further down).
    const banner = screen.getByRole("region", { name: "Welcome back, Ananya" });
    expect(within(banner).getByText("248 / 300")).toBeInTheDocument();
  });

  it("shows the four numbers with their notes", () => {
    expect(kpi("Confirmed sessions")).toHaveTextContent("3");
    expect(kpi("Confirmed sessions")).toHaveTextContent("1 under review");
    expect(kpi("Total registrations")).toHaveTextContent("642");
    expect(kpi("Total registrations")).toHaveTextContent("▲ 58 this week");
    expect(kpi("Average rating")).toHaveTextContent("4.6 / 5");
    expect(kpi("Average rating")).toHaveTextContent("312 ratings, past events");
    expect(kpi("Open to-dos")).toHaveTextContent("3");
    expect(kpi("Open to-dos")).toHaveTextContent("Next due 15 Nov");
  });

  it("summarises the registrations and gives the chart a text alternative", () => {
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Registrations across your sessions",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("+230")).toBeInTheDocument();
    expect(
      screen.getByText("Avg. per day").previousElementSibling,
    ).toHaveTextContent("18");
    expect(
      screen.getByRole("img", {
        name: "Registrations grew from 412 on 7 Oct to 642 on 20 Oct",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/18 Oct:/)).toBeInTheDocument();
  });

  it("has the numbers in a table that is hidden by a wrapping div, not by the table itself", () => {
    const table = screen.getByRole("table", {
      name: "Registrations across your sessions, by day",
    });
    expect(table).not.toHaveClass("sr-only");
    expect(table.parentElement).toHaveClass("sr-only");
    expect(screen.getByRole("row", { name: /^7 Oct/ })).toHaveTextContent(
      "412",
    );
  });

  it("lists the sessions with seats and status", () => {
    expect(
      screen.getByRole("link", {
        name: "Scaling Next.js Applications: Lessons from Production",
      }),
    ).toHaveAttribute("href", `/speaker/sessions/${SESSION_ID}`);
    expect(screen.getByText("38 / 40 · almost full")).toBeInTheDocument();
    expect(screen.getAllByText("Confirmed")).toHaveLength(3);
    expect(screen.getByText("Under review")).toBeInTheDocument();
    expect(screen.getByText("Not scheduled yet")).toBeInTheDocument();
    expect(
      screen.getByText("14:00 – 16:00 · Lab 3 · Workshop"),
    ).toBeInTheDocument();
  });

  it("lists the to-dos, including completing the profile", () => {
    expect(screen.getByText("1 of 4 done")).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", { name: "To-dos done" }),
    ).toHaveAttribute("aria-valuenow", "1");
    expect(screen.getByText(/Complete speaker profile/)).toBeInTheDocument();
    expect(screen.getByText("Due 15 Nov · 26 days left")).toBeInTheDocument();
    expect(screen.getByText("Accept speaker agreement")).toHaveTextContent(
      "Done: Accept speaker agreement",
    );
  });

  it("shows the feedback summary", () => {
    expect(
      screen.getByRole("img", { name: "4.6 out of 5 stars" }),
    ).toBeInTheDocument();
    const breakdown = screen.getByRole("list", { name: "Rating breakdown" });
    expect(within(breakdown).getByText("68%")).toBeInTheDocument();
    expect(
      screen.getByText(/Clear examples, and the comparison of state libraries/),
    ).toBeInTheDocument();
  });

  it("shows the updates with relative times", () => {
    expect(
      screen.getByRole("heading", { level: 2, name: "Recent updates" }),
    ).toBeInTheDocument();
    expect(screen.getByText("2 hours ago")).toBeInTheDocument();
    expect(screen.getByText("5 hours ago")).toBeInTheDocument();
    expect(screen.getByText("7 hours ago")).toBeInTheDocument();
  });

  it("links to the final paths", () => {
    const href = (name: string) =>
      screen.getByRole("link", { name }).getAttribute("href");

    expect(href("View session")).toBe(`/speaker/sessions/${SESSION_ID}`);
    expect(href("Prepare polls")).toBe("/speaker/polls");
    expect(href("My schedule")).toBe("/my-schedule");
    expect(href("View all")).toBe("/speaker/sessions");
    expect(href("Open profile")).toBe("/profile");
    expect(href("Upload")).toBe(`/speaker/sessions/${SESSION_ID}`);
    expect(href("See all")).toBe("/notifications");
  });

  it("has one h1", () => {
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });
});

describe("SpeakerHome with no data", () => {
  beforeEach(() =>
    render(<SpeakerHome data={EMPTY_SPEAKER_HOME} now={HOME_SAMPLE_NOW} />),
  );

  it("each section says what is missing", () => {
    expect(screen.getByText("No registrations yet.")).toBeInTheDocument();
    expect(screen.getByText("No sessions yet.")).toBeInTheDocument();
    expect(screen.getByText("Nothing to do right now.")).toBeInTheDocument();
    expect(screen.getByText("No notifications yet.")).toBeInTheDocument();
    // The rating number and the feedback card both say it.
    expect(screen.getAllByText(/No ratings yet/)).toHaveLength(2);
  });

  it("the banner has no countdown", () => {
    expect(
      screen.getByText("You have no upcoming sessions."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();
  });

  it("the numbers are zero or a dash", () => {
    expect(kpi("Confirmed sessions")).toHaveTextContent("0");
    expect(kpi("Average rating")).toHaveTextContent("–");
    expect(kpi("Open to-dos")).toHaveTextContent("All done");
  });
});
