/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { renderWithClient } from "../../__fixtures__/render";
import {
  DESIGN_DAY_ID,
  FUTURES_ID,
  SAMPLE_EVENTS,
  SUMMIT_ID,
} from "../../__fixtures__/event-manage";
import { eventApiService } from "../../api/event-api.service";
import {
  eventEditHref,
  eventHref,
  EVENT_ROUTES,
  publicEventHref,
} from "../../routes";
import type { EventDto } from "../../schemas/events.schemas";
import type { ManagedEvent } from "../../types/event-manage.types";
import { MyEvents } from "../MyEvents";

jest.mock("../../api/event-api.service", () => ({
  eventApiService: {
    listMine: jest.fn(),
    countMine: jest.fn(),
    getOverview: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    cancel: jest.fn(),
  },
}));
const api = jest.mocked(eventApiService);

const counts = { all: 5, draft: 1, published: 2, completed: 1, cancelled: 1 };

/** The server's answer for a page: the rows, and the paging meta. */
const page = (items: ManagedEvent[], total = items.length) => ({
  items,
  meta: { page: 1, pageSize: 10, total },
});

/** The titles in the table, in order. */
function rowTitles() {
  return screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("link")[0].textContent);
}

/** The latest request the page sent for the list. */
const lastListParams = () => api.listMine.mock.calls.at(-1)?.[0];

async function openMenu(
  user: ReturnType<typeof userEvent.setup>,
  title: string,
) {
  await user.click(
    screen.getByRole("button", { name: `Actions for ${title}` }),
  );
}

beforeEach(() => {
  jest.resetAllMocks();
  api.listMine.mockResolvedValue(page([...SAMPLE_EVENTS]));
  api.countMine.mockResolvedValue(counts);
});

describe("MyEvents", () => {
  it("shows the heading and the Create event link", async () => {
    renderWithClient(<MyEvents />);

    expect(
      screen.getByRole("heading", { name: "My events", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create event" })).toHaveAttribute(
      "href",
      EVENT_ROUTES.new,
    );
    await screen.findByRole("table");
  });

  it("shows a skeleton while the first page loads", async () => {
    renderWithClient(<MyEvents />);

    expect(
      screen.getByRole("status", { name: "Loading events" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    await screen.findByRole("table");
    expect(
      screen.queryByRole("status", { name: "Loading events" }),
    ).not.toBeInTheDocument();
  });

  it("asks for the first page of every event, soonest first", async () => {
    renderWithClient(<MyEvents />);
    await screen.findByRole("table");

    expect(lastListParams()).toEqual({
      status: "all",
      search: "",
      sort: "soonest",
      page: 1,
      pageSize: 10,
    });
  });

  it("lists the rows in the order the server sent, each title linking to its overview", async () => {
    renderWithClient(<MyEvents />);
    await screen.findByRole("table");

    expect(rowTitles()).toEqual(SAMPLE_EVENTS.map((event) => event.title));
    const summit = SAMPLE_EVENTS.find((event) => event.id === SUMMIT_ID)!;
    expect(screen.getByRole("link", { name: summit.title })).toHaveAttribute(
      "href",
      eventHref(summit.id),
    );
  });

  it("shows each tab with the count the server gave", async () => {
    renderWithClient(<MyEvents />);
    const tabs = within(
      screen.getByRole("tablist", { name: "Filter events by status" }),
    );

    expect(await tabs.findByRole("tab", { name: "All 5" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(tabs.getByRole("tab", { name: "Draft 1" })).toBeInTheDocument();
    expect(tabs.getByRole("tab", { name: "Published 2" })).toBeInTheDocument();
    expect(tabs.getByRole("tab", { name: "Completed 1" })).toBeInTheDocument();
    expect(tabs.getByRole("tab", { name: "Cancelled 1" })).toBeInTheDocument();
  });

  it("still lists the events when the counts cannot be loaded", async () => {
    api.countMine.mockRejectedValue(new Error("offline"));
    renderWithClient(<MyEvents />);

    await screen.findByRole("table");

    // The tabs show without numbers.
    expect(screen.getByRole("tab", { name: "All" })).toBeInTheDocument();
  });

  it("shows the registrations bar, or a line of text where there is no bar", async () => {
    renderWithClient(<MyEvents />);
    await screen.findByRole("table");

    const summit = screen.getByRole("row", {
      name: /Product Engineering Summit/,
    });
    expect(within(summit).getByText("480 / 600")).toBeInTheDocument();
    expect(
      within(summit).getByRole("progressbar", {
        name: "Seats taken for Product Engineering Summit 2026",
      }),
    ).toHaveAttribute("aria-valuenow", "480");
    const fintech = screen.getByRole("row", { name: /Fintech Product Forum/ });
    expect(
      within(fintech).getByText("Opens when published"),
    ).toBeInTheDocument();
    const meetup = screen.getByRole("row", { name: /Pune Tech Meetup/ });
    expect(
      within(meetup).getByText("86 registrations cancelled"),
    ).toBeInTheDocument();
  });
});

describe("MyEvents: filtering is the server's job", () => {
  it("asks for another status when a tab is chosen, and shows its own rows", async () => {
    const user = userEvent.setup();
    const draft = SAMPLE_EVENTS.find((event) => event.status === "draft")!;
    api.listMine.mockImplementation(async ({ status }) =>
      status === "draft" ? page([draft]) : page([...SAMPLE_EVENTS]),
    );
    renderWithClient(<MyEvents />);
    await screen.findByRole("table");

    await user.click(screen.getByRole("tab", { name: /^Draft/ }));

    await waitFor(() => expect(rowTitles()).toEqual([draft.title]));
    expect(lastListParams()).toMatchObject({ status: "draft", page: 1 });
  });

  it("shows the skeleton, never the previous rows, while another tab loads", async () => {
    const user = userEvent.setup();
    let release: (value: ReturnType<typeof page>) => void = () => {};
    api.listMine.mockImplementation(({ status }) =>
      status === "draft"
        ? new Promise((resolve) => {
            release = resolve;
          })
        : Promise.resolve(page([...SAMPLE_EVENTS])),
    );
    renderWithClient(<MyEvents />);
    await screen.findByRole("table");

    await user.click(screen.getByRole("tab", { name: /^Draft/ }));

    expect(
      screen.getByRole("status", { name: "Loading events" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Product Engineering Summit 2026"),
    ).not.toBeInTheDocument();
    release(page([SAMPLE_EVENTS[2]]));
    await screen.findByText("Fintech Product Forum");
  });

  it("sends the search once the organizer stops typing", async () => {
    const user = userEvent.setup();
    renderWithClient(<MyEvents />);
    await screen.findByRole("table");

    await user.type(
      screen.getByRole("searchbox", { name: "Search events by title" }),
      "design",
    );

    await waitFor(() =>
      expect(lastListParams()).toMatchObject({ search: "design" }),
    );
    // Typed in one go: the server was not asked for "d", "de", "des"...
    const searches = api.listMine.mock.calls.map(([params]) => params.search);
    expect(searches).not.toContain("d");
    expect(searches).not.toContain("des");
  });

  it("asks for the other sort order", async () => {
    const user = userEvent.setup();
    renderWithClient(<MyEvents />);
    await screen.findByRole("table");

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Sort" }),
      "latest",
    );

    await waitFor(() =>
      expect(lastListParams()).toMatchObject({ sort: "latest" }),
    );
  });

  it("starts again from the first page when the tab changes", async () => {
    const user = userEvent.setup();
    api.listMine.mockResolvedValue({
      items: SAMPLE_EVENTS.slice(0, 2),
      meta: { page: 1, pageSize: 10, total: 25 },
    });
    renderWithClient(<MyEvents />);
    await screen.findByRole("table");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(lastListParams()).toMatchObject({ page: 2 }));

    await user.click(screen.getByRole("tab", { name: /^Draft/ }));

    await waitFor(() =>
      expect(lastListParams()).toMatchObject({ status: "draft", page: 1 }),
    );
  });

  it("pages through the list", async () => {
    const user = userEvent.setup();
    api.listMine.mockResolvedValue({
      items: SAMPLE_EVENTS.slice(0, 2),
      meta: { page: 1, pageSize: 10, total: 25 },
    });
    renderWithClient(<MyEvents />);
    await screen.findByRole("table");

    expect(screen.getByText(/Showing 1–2 of 25/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => expect(lastListParams()).toMatchObject({ page: 2 }));
  });
});

describe("MyEvents: empty, error", () => {
  it("invites the organizer to create a first event when there are none", async () => {
    api.listMine.mockResolvedValue(page([]));
    renderWithClient(<MyEvents />);

    expect(
      await screen.findByText("You have not created an event yet."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Create your first event" }),
    ).toHaveAttribute("href", EVENT_ROUTES.new);
  });

  it("says nothing matches a tab or search, and clears the filters", async () => {
    const user = userEvent.setup();
    api.listMine.mockImplementation(async ({ status }) =>
      status === "draft" ? page([]) : page([...SAMPLE_EVENTS]),
    );
    renderWithClient(<MyEvents />);
    await screen.findByRole("table");

    await user.click(screen.getByRole("tab", { name: /^Draft/ }));
    expect(
      await screen.findByText("No events match your filters."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));

    await waitFor(() => expect(rowTitles()).toHaveLength(5));
    expect(lastListParams()).toMatchObject({ status: "all", search: "" });
  });

  it("shows an error with the server's message and a way to try again", async () => {
    const user = userEvent.setup();
    api.listMine.mockRejectedValueOnce(
      new ApiError(503, "CMS_UNAVAILABLE", "Try again in a moment"),
    );
    renderWithClient(<MyEvents />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't load your events",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Try again in a moment",
    );
    await user.click(screen.getByRole("button", { name: "Try again" }));

    await screen.findByRole("table");
    expect(api.listMine).toHaveBeenCalledTimes(2);
  });
});

describe("a row's menu", () => {
  it("offers manage, edit and the public page for a draft", async () => {
    const user = userEvent.setup();
    renderWithClient(<MyEvents />);
    await screen.findByRole("table");
    const draft = SAMPLE_EVENTS[2];

    await openMenu(user, draft.title);

    const menu = within(screen.getByRole("menu"));
    expect(
      menu.getByRole("menuitem", { name: "Manage event" }),
    ).toHaveAttribute("href", eventHref(draft.id));
    expect(
      menu.getByRole("menuitem", { name: "Edit details" }),
    ).toHaveAttribute("href", eventEditHref(draft.id));
    expect(
      menu.getByRole("menuitem", { name: "View public page" }),
    ).toHaveAttribute("href", publicEventHref(draft.slug));
  });

  it("offers Cancel event last for a published event", async () => {
    const user = userEvent.setup();
    renderWithClient(<MyEvents />);
    await screen.findByRole("table");

    await openMenu(user, "Design Systems Engineering Day");

    expect(
      within(screen.getByRole("menu"))
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual([
      "Manage event",
      "Edit details",
      "View public page",
      "Cancel event",
    ]);
  });

  it("does not offer cancelling a draft, and deleting one has no endpoint yet", async () => {
    const user = userEvent.setup();
    renderWithClient(<MyEvents />);
    await screen.findByRole("table");

    await openMenu(user, "Fintech Product Forum");

    const menu = within(screen.getByRole("menu"));
    expect(
      menu.queryByRole("menuitem", { name: "Delete draft" }),
    ).not.toBeInTheDocument();
    expect(
      menu.queryByRole("menuitem", { name: "Cancel event" }),
    ).not.toBeInTheDocument();
  });

  it("only lets a completed or cancelled event be opened and viewed", async () => {
    const user = userEvent.setup();
    renderWithClient(<MyEvents />);
    await screen.findByRole("table");
    const completed = SAMPLE_EVENTS.find((event) => event.id === FUTURES_ID)!;

    await openMenu(user, completed.title);

    expect(
      within(screen.getByRole("menu"))
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual(["Manage event", "View public page"]);
  });

  it("offers editing for a published event", async () => {
    const user = userEvent.setup();
    renderWithClient(<MyEvents />);
    await screen.findByRole("table");
    const published = SAMPLE_EVENTS.find(
      (event) => event.id === DESIGN_DAY_ID,
    )!;

    await openMenu(user, published.title);

    expect(
      within(screen.getByRole("menu")).getByRole("menuitem", {
        name: "Edit details",
      }),
    ).toBeInTheDocument();
  });
});

describe("cancelling an event", () => {
  const designDay = SAMPLE_EVENTS.find((event) => event.id === DESIGN_DAY_ID)!;

  /** What the API answers once the event is cancelled. */
  const cancelledEvent: EventDto = {
    id: designDay.id,
    slug: designDay.slug,
    title: designDay.title,
    status: "cancelled",
    startAt: designDay.startAt,
    endAt: designDay.endAt,
    timezone: designDay.timezone,
    venueId: designDay.venue?.id ?? null,
    capacity: designDay.capacity,
    ticketPrice: designDay.ticketPrice,
    currency: "INR",
    registrationOpensAt: null,
    registrationClosesAt: null,
    publishedAt: "2026-10-01T10:00:00.000Z",
    createdAt: "2026-09-01T10:00:00.000Z",
  };

  async function chooseCancel(user: ReturnType<typeof userEvent.setup>) {
    await screen.findByRole("table");
    await openMenu(user, designDay.title);
    await user.click(screen.getByRole("menuitem", { name: "Cancel event" }));
  }

  it("asks first, and sends nothing when the organizer keeps the event", async () => {
    const user = userEvent.setup();
    renderWithClient(<MyEvents />);

    await chooseCancel(user);
    const dialog = within(
      screen.getByRole("dialog", { name: "Cancel this event?" }),
    );
    await user.click(dialog.getByRole("button", { name: "Keep event" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(api.cancel).not.toHaveBeenCalled();
  });

  it("cancels the event once confirmed, reads the list again and says so", async () => {
    const user = userEvent.setup();
    api.cancel.mockResolvedValue(cancelledEvent);
    renderWithClient(<MyEvents />);

    await chooseCancel(user);
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Cancel event",
      }),
    );

    expect(
      await screen.findByText("Design Systems Engineering Day was cancelled"),
    ).toBeInTheDocument();
    expect(api.cancel).toHaveBeenCalledWith(DESIGN_DAY_ID);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // The row now belongs to another tab: the list and the counts are asked for again.
    await waitFor(() => expect(api.listMine).toHaveBeenCalledTimes(2));
    expect(api.countMine).toHaveBeenCalledTimes(2);
  });

  it("shows the server's message when the event cannot be cancelled", async () => {
    const user = userEvent.setup();
    api.cancel.mockRejectedValue(
      new ApiError(409, "EVENT_NOT_CANCELLABLE", "The event has ended"),
    );
    renderWithClient(<MyEvents />);

    await chooseCancel(user);
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Cancel event",
      }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't cancel the event",
    );
    expect(screen.getByRole("alert")).toHaveTextContent("The event has ended");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
