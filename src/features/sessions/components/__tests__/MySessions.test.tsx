/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  allSessions,
  endedPanel,
  NOW,
  pwaTalk,
  reduxTalk,
  scalingTalk,
  sentryDraft,
  zodWorkshop,
} from "../../__fixtures__/sessions";
import { SESSION_ROUTES, sessionHref } from "../../routes";
import { MySessions } from "../MySessions";
import { SessionListSkeleton } from "../SessionListSkeleton";

function renderPage(props: Partial<Parameters<typeof MySessions>[0]> = {}) {
  return render(<MySessions sessions={allSessions} now={NOW} {...props} />);
}

/** The titles in the table, in order. */
function rowTitles() {
  return screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("link")[0].textContent);
}

describe("MySessions", () => {
  it("shows the heading, a link to submit a session and the sample-data note", () => {
    renderPage();
    expect(
      screen.getByRole("heading", { name: "My sessions", level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Submit a session" }),
    ).toHaveAttribute("href", SESSION_ROUTES.create);
    expect(screen.getByText("Sample data")).toBeInTheDocument();
  });

  it("lists upcoming sessions first, then not scheduled ones, then past ones", () => {
    renderPage();
    expect(rowTitles()).toEqual([
      scalingTalk.title,
      zodWorkshop.title,
      sentryDraft.title,
      pwaTalk.title,
      endedPanel.title,
      reduxTalk.title,
    ]);
  });

  it("shows each tab with its count", () => {
    renderPage();
    const tabs = within(
      screen.getByRole("tablist", { name: "Filter sessions by status" }),
    );
    expect(tabs.getByRole("tab", { name: "All 6" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(tabs.getByRole("tab", { name: "Confirmed 2" })).toBeInTheDocument();
    expect(
      tabs.getByRole("tab", { name: "Under review 1" }),
    ).toBeInTheDocument();
    expect(tabs.getByRole("tab", { name: "Drafts 1" })).toBeInTheDocument();
    expect(tabs.getByRole("tab", { name: "Past 2" })).toBeInTheDocument();
  });

  it("filters by tab: Past shows the finished sessions only", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("tab", { name: /^Past/ }));
    expect(screen.getByRole("tab", { name: /^Past/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(rowTitles()).toEqual([endedPanel.title, reduxTalk.title]);

    await userEvent.click(screen.getByRole("tab", { name: /^Confirmed/ }));
    expect(rowTitles()).toEqual([scalingTalk.title, zodWorkshop.title]);

    await userEvent.click(screen.getByRole("tab", { name: /^Drafts/ }));
    expect(rowTitles()).toEqual([sentryDraft.title]);
  });

  it("moves between tabs with the arrow keys", async () => {
    renderPage();
    screen.getByRole("tab", { name: /^All/ }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: /^Confirmed/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("links every title to the session page", () => {
    renderPage();
    expect(
      screen.getByRole("link", { name: scalingTalk.title }),
    ).toHaveAttribute("href", sessionHref(scalingTalk.id));
    expect(screen.getByRole("link", { name: reduxTalk.title })).toHaveAttribute(
      "href",
      `/speaker/sessions/${reduxTalk.id}`,
    );
  });

  it("shows a status badge with a text label on every row", () => {
    renderPage();
    const row = screen.getByRole("row", {
      name: new RegExp(sentryDraft.title),
    });
    expect(within(row).getByText("Draft")).toBeInTheDocument();
    const pwaRow = screen.getByRole("row", { name: new RegExp(pwaTalk.title) });
    expect(within(pwaRow).getByText("Under review")).toBeInTheDocument();
    expect(within(pwaRow).getByText("Not yet scheduled")).toBeInTheDocument();
  });

  it("shows seats with a progress bar, and warns in words when almost full", () => {
    renderPage();
    const row = screen.getByRole("row", {
      name: new RegExp(scalingTalk.title),
    });
    expect(within(row).getByText(/95 \/ 100/)).toBeInTheDocument();
    expect(within(row).getByText(/Almost full/)).toBeInTheDocument();
    expect(within(row).getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "95",
    );
    // Not full: no warning
    const other = screen.getByRole("row", {
      name: new RegExp(zodWorkshop.title),
    });
    expect(within(other).queryByText(/Almost full/)).not.toBeInTheDocument();
  });

  it("shows attendance and rating for a finished session", () => {
    renderPage();
    const row = screen.getByRole("row", { name: new RegExp(reduxTalk.title) });
    expect(within(row).getByText("412 attended")).toBeInTheDocument();
    expect(within(row).getByText(/Rated 4\.7 \/ 5/)).toBeInTheDocument();
  });

  it("searches by title or track", async () => {
    renderPage();
    await userEvent.type(
      screen.getByRole("searchbox", { name: "Search sessions" }),
      "zod",
    );
    expect(rowTitles()).toEqual([zodWorkshop.title]);
  });

  it("filters by event and by format", async () => {
    renderPage();
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Event" }),
      "Meetup",
    );
    expect(rowTitles()).toEqual([zodWorkshop.title, sentryDraft.title]);

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Format" }),
      "workshop",
    );
    expect(rowTitles()).toEqual([zodWorkshop.title]);
  });

  it("sorts by registrations", async () => {
    renderPage();
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Sort" }),
      "registrations",
    );
    expect(rowTitles()[0]).toBe(reduxTalk.title);
  });

  it("says nothing matches and offers to clear the filters", async () => {
    renderPage();
    await userEvent.type(
      screen.getByRole("searchbox", { name: "Search sessions" }),
      "zzz",
    );
    expect(
      screen.getByText("No sessions match your filters."),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Clear filters" }),
    );
    expect(rowTitles()).toHaveLength(6);
    expect(
      screen.getByRole("searchbox", { name: "Search sessions" }),
    ).toHaveValue("");
  });

  it("shows an empty state with a link to submit when there are no sessions at all", () => {
    renderPage({ sessions: [] });
    expect(screen.getByText("You have no sessions yet.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Submit your first session" }),
    ).toHaveAttribute("href", SESSION_ROUTES.create);
  });

  it("pages the list and starts again from page 1 after a new filter", async () => {
    renderPage({ pageSize: 4 });
    expect(rowTitles()).toHaveLength(4);
    expect(screen.getByText(/Showing 1–4 of 6/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(rowTitles()).toEqual([endedPanel.title, reduxTalk.title]);
    expect(screen.getByText(/Showing 5–6 of 6/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: /^Past/ }));
    expect(screen.getByText(/Showing 1–2 of 2/)).toBeInTheDocument();
  });

  it("shows the loading skeleton", () => {
    renderPage({ state: "loading" });
    expect(
      screen.getByRole("status", { name: "Loading sessions" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows an error with Try again", async () => {
    const onRetry = jest.fn();
    renderPage({ state: "error", onRetry });
    expect(
      screen.getByText("We couldn't load your sessions"),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("leaves out the Try again button when nothing can retry", () => {
    renderPage({ state: "error" });
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
  });
});

describe("SessionListSkeleton", () => {
  it("is announced as loading", () => {
    render(<SessionListSkeleton />);
    expect(
      screen.getByRole("status", { name: "Loading sessions" }),
    ).toBeInTheDocument();
  });
});
