/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { adminOrganizerHref } from "@/src/features/organizer";
import { renderWithClient } from "../../__fixtures__/render";
import {
  BRIGHTSIDE,
  DESIGN_DAY_ID,
  FINTECH_ID,
  FUTURES_ID,
  KINETIC,
  SAMPLE_EVENTS,
} from "../../__fixtures__/event-manage";
import { eventApiService } from "../../api/event-api.service";
import {
  eventAttendeesHref,
  eventCheckInHref,
  eventHref,
  eventSessionsHref,
  EVENT_ROUTES,
} from "../../routes";
import type { ManagedEvent } from "../../types/event-manage.types";
import { ManageEvents, MyEvents } from "../MyEvents";

jest.mock("../../api/event-api.service", () => ({
  eventApiService: {
    listMine: jest.fn(),
    countMine: jest.fn(),
    cancel: jest.fn(),
    remove: jest.fn(),
  },
}));
const api = jest.mocked(eventApiService);

const counts = {
  all: 103,
  draft: 14,
  published: 52,
  completed: 31,
  cancelled: 6,
};

const page = (items: ManagedEvent[], total = items.length) => ({
  items,
  meta: { page: 1, pageSize: 10, total },
});

const byId = (id: string) => SAMPLE_EVENTS.find((event) => event.id === id)!;

/** A count card, found by its label (the table also has a "Registrations" column). */
function kpi(label: string) {
  const labelLine = screen
    .getAllByText(label)
    .find((element) => element.tagName === "P");
  if (!labelLine?.parentElement) throw new Error(`no card "${label}"`);
  return labelLine.parentElement;
}

async function menuItemsOf(
  user: ReturnType<typeof userEvent.setup>,
  title: string,
) {
  await user.click(
    screen.getByRole("button", { name: `Actions for ${title}` }),
  );
  return within(screen.getByRole("menu")).getAllByRole("menuitem");
}

beforeEach(() => {
  jest.resetAllMocks();
  api.listMine.mockResolvedValue(page([...SAMPLE_EVENTS]));
  api.countMine.mockResolvedValue(counts);
});

describe("ManageEvents (admin)", () => {
  it("is the admin's page: its own heading, no Create event (only organizers create), Export CSV off and Static", async () => {
    renderWithClient(<ManageEvents />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Manage events" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Create event" })).toBeNull();
    expect(screen.getByRole("button", { name: "Export CSV" })).toBeDisabled();
    await screen.findByRole("table");
  });

  it("shows the count cards from the same counts as the tabs; registrations across events is Static", async () => {
    renderWithClient(<ManageEvents />);

    await waitFor(() => expect(kpi("Total events")).toHaveTextContent("103"));
    expect(kpi("Published")).toHaveTextContent("52");
    expect(kpi("Completed")).toHaveTextContent("31");
    expect(kpi("Drafts")).toHaveTextContent("14");
    expect(kpi("Cancelled")).toHaveTextContent("6");
    expect(kpi("Registrations")).toHaveTextContent("—");
    expect(kpi("Registrations")).toHaveTextContent("Static");
    // One counts request feeds both the cards and the tabs.
    expect(api.countMine).toHaveBeenCalledTimes(1);
  });

  it("still lists the events when the counts fail (the cards show —)", async () => {
    api.countMine.mockRejectedValue(
      new ApiError(503, "SERVICE_UNAVAILABLE", "Busy"),
    );
    renderWithClient(<ManageEvents />);

    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(kpi("Total events")).toHaveTextContent("—");
  });

  it("names each event's organizer in its own column", async () => {
    renderWithClient(<ManageEvents />);
    const table = await screen.findByRole("table", {
      name: "Every organizer's events",
    });

    expect(
      within(table).getByRole("columnheader", { name: "Organizer" }),
    ).toBeInTheDocument();
    const futures = within(table)
      .getByRole("link", { name: byId(FUTURES_ID).title })
      .closest("tr")!;
    expect(within(futures).getByText(BRIGHTSIDE.name)).toBeInTheDocument();
    expect(within(table).getAllByText(KINETIC.name)).toHaveLength(4);
  });

  it("opens the event's own page when a title is clicked", async () => {
    renderWithClient(<ManageEvents />);
    await screen.findByRole("table");
    const event = byId(DESIGN_DAY_ID);

    expect(screen.getByRole("link", { name: event.title })).toHaveAttribute(
      "href",
      eventHref(event.id),
    );
  });

  it("asks the server for the search and the sort; organizer, format and date are switched off and Static", async () => {
    const user = userEvent.setup();
    renderWithClient(<ManageEvents />);
    await screen.findByRole("table");

    for (const name of ["Organizer", "Format", "Date"]) {
      expect(screen.getByRole("combobox", { name })).toBeDisabled();
    }
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Sort" }),
      "latest",
    );
    await user.type(
      screen.getByRole("searchbox", { name: "Search events by title" }),
      "summit",
    );

    await waitFor(() =>
      expect(api.listMine).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: "summit", sort: "latest", page: 1 }),
      ),
    );
  });

  it("says no organizer has an event yet, with no Create button, when there is none", async () => {
    api.listMine.mockResolvedValue(page([]));
    renderWithClient(<ManageEvents />);

    expect(
      await screen.findByText("No organizer has created an event yet."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Create your first event/ }),
    ).toBeNull();
  });

  it("names the failure without 'your' and offers Try again", async () => {
    api.listMine.mockRejectedValue(
      new ApiError(500, "INTERNAL", "Try again in a moment"),
    );
    renderWithClient(<ManageEvents />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't load the events",
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
  });
});

// The admin VIEWS organizers' events: the server refuses an admin's edit, cancel and delete, so
// the menu never offers them.
describe("ManageEvents: a row's menu (view only)", () => {
  it("a published event: view it, its registrations and sessions, the door, its organizer and public page", async () => {
    const user = userEvent.setup();
    renderWithClient(<ManageEvents />);
    await screen.findByRole("table");
    const event = byId(DESIGN_DAY_ID);

    const items = await menuItemsOf(user, event.title);

    expect(items.map((item) => item.textContent)).toEqual([
      "View event",
      "View registrations",
      "View sessions",
      "Check in at the door",
      "View organizer",
      "View public page",
    ]);
    const href = (name: string) =>
      items.find((item) => item.textContent === name)?.getAttribute("href");
    expect(href("View registrations")).toBe(eventAttendeesHref(event.id));
    expect(href("View sessions")).toBe(eventSessionsHref(event.id));
    expect(href("Check in at the door")).toBe(eventCheckInHref(event.id));
    expect(href("View organizer")).toBe(adminOrganizerHref(KINETIC.id));
  });

  it("a draft: no registrations, door or public page yet, and no Delete draft", async () => {
    const user = userEvent.setup();
    renderWithClient(<ManageEvents />);
    await screen.findByRole("table");

    const items = await menuItemsOf(user, byId(FINTECH_ID).title);

    expect(items.map((item) => item.textContent)).toEqual([
      "View event",
      "View sessions",
      "View organizer",
    ]);
  });

  it("a completed event: its registrations and organizer, no door any more", async () => {
    const user = userEvent.setup();
    renderWithClient(<ManageEvents />);
    await screen.findByRole("table");

    const items = await menuItemsOf(user, byId(FUTURES_ID).title);

    expect(items.map((item) => item.textContent)).toEqual([
      "View event",
      "View registrations",
      "View sessions",
      "View organizer",
      "View public page",
    ]);
    expect(
      items
        .find((item) => item.textContent === "View organizer")
        ?.getAttribute("href"),
    ).toBe(adminOrganizerHref(BRIGHTSIDE.id));
  });
});

describe("MyEvents (organizer) is unchanged by the admin's page", () => {
  it("has no Organizer column, no count cards and no Static filters", async () => {
    renderWithClient(<MyEvents />);
    const table = await screen.findByRole("table", { name: "Your events" });

    expect(
      within(table).queryByRole("columnheader", { name: "Organizer" }),
    ).toBeNull();
    expect(screen.queryByText("Total events")).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Organizer" })).toBeNull();
    expect(screen.getByRole("link", { name: "Create event" })).toHaveAttribute(
      "href",
      EVENT_ROUTES.new,
    );
  });
});
