/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  allItems,
  NOW,
  opening,
  talkA,
  talkB,
} from "../../__fixtures__/schedule";
import { SchedulePage } from "../SchedulePage";

function renderPage(props: Partial<Parameters<typeof SchedulePage>[0]> = {}) {
  return render(<SchedulePage items={allItems} now={NOW} {...props} />);
}

const tab = (name: RegExp) => screen.getByRole("tab", { name });
const rows = () =>
  within(screen.getByRole("tabpanel")).getAllByRole("listitem");

describe("SchedulePage: days and order", () => {
  it("has a tab per day with how many items it holds", () => {
    renderPage();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(tab(/Thu, 3 Dec/)).toHaveTextContent("1");
    expect(tab(/Fri, 4 Dec/)).toHaveTextContent("2");
    expect(tab(/Sat, 5 Dec/)).toHaveTextContent("0");
  });

  it("opens today's day first, with its heading", () => {
    renderPage();
    expect(tab(/Fri, 4 Dec/)).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("region", { name: "Friday, 4 December 2026" }),
    ).toBeInTheDocument();
  });

  it("lists the day's items in time order with time, length and place", () => {
    renderPage();
    const [first, second] = rows();
    expect(first).toHaveTextContent("10:00");
    expect(first).toHaveTextContent("45 min");
    expect(first).toHaveTextContent("Talk A");
    expect(first).toHaveTextContent("Hall B · Talk");
    expect(second).toHaveTextContent("10:30");
    expect(second).toHaveTextContent("with Meera Joshi, Karan Shah");
  });

  it("moves to another day", async () => {
    renderPage();
    await userEvent.click(tab(/Thu, 3 Dec/));
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveTextContent(opening.title);
  });

  it("moves between day tabs with the arrow keys", async () => {
    renderPage();
    tab(/Fri, 4 Dec/).focus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(tab(/Thu, 3 Dec/)).toHaveAttribute("aria-selected", "true");
  });

  it("says nothing is in the schedule on a day without items", async () => {
    renderPage();
    await userEvent.click(tab(/Sat, 5 Dec/));
    expect(
      screen.getByText(/Nothing in your schedule on this day/),
    ).toBeInTheDocument();
  });

  it("marks the sessions the person speaks in", () => {
    renderPage();
    expect(screen.getByText("You are speaking")).toBeInTheDocument();
  });
});

describe("SchedulePage: conflicts", () => {
  it("marks both overlapping sessions, in words", () => {
    renderPage();
    const [a, b] = rows();
    expect(a).toHaveTextContent("Overlaps with Talk B");
    expect(b).toHaveTextContent("Overlaps with Talk A");
  });

  it("warns at the top how many sessions overlap", () => {
    renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "2 sessions overlap in your schedule",
    );
  });

  it("clears the warning when one of the pair is removed", async () => {
    renderPage();
    await userEvent.click(
      screen.getByRole("button", {
        name: `Remove from my schedule: ${talkB.title}`,
      }),
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(/Overlaps with/)).toBeNull();
  });

  it("shows no warning without overlaps", () => {
    renderPage({ items: [opening, talkA] });
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("SchedulePage: My items and the full programme", () => {
  it("shows only added sessions in My items", () => {
    renderPage();
    expect(screen.queryByText("Talk C")).toBeNull();
    expect(screen.queryByText("Coffee break")).toBeNull();
    expect(screen.getByRole("button", { name: "My items" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("shows everything in the full programme, with Add on what is not added", async () => {
    renderPage();
    await userEvent.click(
      screen.getByRole("button", { name: "Full programme" }),
    );
    expect(rows()).toHaveLength(4);
    expect(screen.getByText("Coffee break")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add to my schedule: Talk C" }),
    ).toBeInTheDocument();
    // A break has no Add button.
    expect(
      screen.queryByRole("button", { name: /my schedule: Coffee break/ }),
    ).toBeNull();
    // The counts follow the view.
    expect(tab(/Sat, 5 Dec/)).toHaveTextContent("1");
  });

  it("adds a session and then it shows in My items", async () => {
    renderPage();
    await userEvent.click(
      screen.getByRole("button", { name: "Full programme" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Add to my schedule: Talk C" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "My items" }));
    expect(screen.getByText("Talk C")).toBeInTheDocument();
    expect(tab(/Fri, 4 Dec/)).toHaveTextContent("3");
  });

  it("removes a session from My items", async () => {
    renderPage({ items: [opening, talkA] });
    await userEvent.click(
      screen.getByRole("button", {
        name: `Remove from my schedule: ${talkA.title}`,
      }),
    );
    expect(screen.queryByText(talkA.title)).toBeNull();
  });
});

describe("SchedulePage: export", () => {
  it("hands over an .ics with the sessions in the schedule", async () => {
    const onExport = jest.fn();
    renderPage({ onExport });
    await userEvent.click(
      screen.getByRole("button", { name: /Export to calendar/ }),
    );
    expect(onExport).toHaveBeenCalledTimes(1);
    const ics: string = onExport.mock.calls[0][0];
    expect(ics).toContain("SUMMARY:Talk A");
    expect(ics).not.toContain("Talk C");
    expect(screen.getByRole("status")).toHaveTextContent("3 sessions saved to");
  });

  it("cannot export an empty schedule", () => {
    renderPage({ items: [{ ...opening, inSchedule: false }] });
    expect(
      screen.getByRole("button", { name: /Export to calendar/ }),
    ).toBeDisabled();
  });
});

describe("SchedulePage: states", () => {
  it("shows the empty state, which leads to the full programme", async () => {
    renderPage({ items: [{ ...opening, inSchedule: false }] });
    expect(screen.getByText("Your schedule is empty")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Browse the full programme" }),
    );
    expect(screen.getByText(opening.title)).toBeInTheDocument();
  });

  it("says so when the programme itself is empty", () => {
    renderPage({ items: [] });
    expect(
      screen.getByText("No sessions are scheduled yet."),
    ).toBeInTheDocument();
  });

  it("shows the loading state", () => {
    renderPage({ isLoading: true });
    expect(
      screen.getByRole("status", { name: "Loading your schedule" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("tab")).toBeNull();
  });

  it("shows the error with a Try again button", async () => {
    const onRetry = jest.fn();
    renderPage({ error: "Network down", onRetry });
    expect(screen.getByRole("alert")).toHaveTextContent("Network down");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("works with its own sample data and makes no network call", () => {
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy;
    render(<SchedulePage />);
    expect(
      screen.getByRole("heading", { name: "My schedule" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
