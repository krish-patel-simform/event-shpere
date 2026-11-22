/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { registrationApiService } from "../../api/registration-api.service";
import type {
  AttendeeCounts,
  AttendeeDto,
} from "../../schemas/attendees.schemas";
import {
  EventAttendeeList,
  type AttendeeListEvent,
} from "../EventAttendeeList";

jest.mock("../../api/registration-api.service", () => ({
  registrationApiService: {
    listEventAttendees: jest.fn(),
  },
}));
const api = jest.mocked(registrationApiService);

const EVENT_ID = "6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d";

// 3 Dec 09:00 IST – 5 Dec 18:00 IST: three event days.
const event = (
  overrides: Partial<AttendeeListEvent> = {},
): AttendeeListEvent => ({
  id: EVENT_ID,
  startAt: "2026-12-03T03:30:00.000Z",
  endAt: "2026-12-05T12:30:00.000Z",
  timezone: "Asia/Kolkata",
  capacity: 600,
  sessionBookings: 1286,
  ...overrides,
});

const priya: AttendeeDto = {
  registrationId: "1b2c3d4e-5f6a-4b7c-8d9e-000000000001",
  firstName: "Priya",
  lastName: "Shah",
  email: "priya.shah@example.com",
  ticketCode: "ESEVT1Y6D4S",
  status: "registered",
  // 2 Nov 14:19 IST.
  registeredAt: "2026-11-02T08:49:00.000Z",
  // 4 Dec 09:41 IST.
  checkedInAt: "2026-12-04T04:11:00.000Z",
  checkedInBy: { firstName: "Omkar", lastName: "Patil" },
  checkInMethod: "manual",
};
const amit: AttendeeDto = {
  ...priya,
  registrationId: "1b2c3d4e-5f6a-4b7c-8d9e-000000000002",
  firstName: "Amit",
  lastName: "Verma",
  email: "amit.verma@example.com",
  ticketCode: "ESEVT9J3W2C",
  checkedInAt: null,
  checkedInBy: null,
  checkInMethod: null,
};
const sandeep: AttendeeDto = {
  ...amit,
  registrationId: "1b2c3d4e-5f6a-4b7c-8d9e-000000000003",
  firstName: "Sandeep",
  lastName: "Kulkarni",
  email: "sandeep.k@example.com",
  ticketCode: "ESEVT6H7Q3D",
  status: "cancelled",
};

const COUNTS: AttendeeCounts = {
  registered: 480,
  cancelled: 17,
  checkedIn: 213,
  pending: 267,
};

const answer = (
  items: AttendeeDto[],
  { total = items.length, counts = COUNTS } = {},
) => ({
  items,
  // The dev setting (a year): every day that has not closed yet can be checked in.
  meta: { page: 1, pageSize: 10, total, counts, checkInOpensHoursBefore: 8760 },
});

const DEFAULT_QUERY = {
  page: 1,
  pageSize: 10,
  status: "all",
  checkedIn: "all",
  sort: "newest",
  search: "",
  date: undefined,
};

function renderList(overrides: Partial<AttendeeListEvent> = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <EventAttendeeList event={event(overrides)} />
    </QueryClientProvider>,
  );
}

/** The count card with this label. */
const kpi = (label: string) =>
  within(screen.getByText(label, { selector: "p" }).parentElement!);

// The counts are read with their own one-row request; the rows' requests ask for a full page.
const rowQueries = () =>
  api.listEventAttendees.mock.calls
    .map(([, params]) => params)
    .filter((params) => params.pageSize !== 1);
const countQueries = () =>
  api.listEventAttendees.mock.calls
    .map(([, params]) => params)
    .filter((params) => params.pageSize === 1);
const lastQuery = () => rowQueries().at(-1);

beforeEach(() => {
  jest.resetAllMocks();
  api.listEventAttendees.mockResolvedValue(answer([priya, amit, sandeep]));
});

describe("EventAttendeeList: what it shows", () => {
  it("asks for the first page of everyone, newest first, then shows the counts", async () => {
    renderList();

    expect(
      screen.getByRole("status", { name: "Loading attendees" }),
    ).toBeInTheDocument();
    expect(api.listEventAttendees).toHaveBeenCalledWith(
      EVENT_ID,
      DEFAULT_QUERY,
    );

    await screen.findByText("Priya Shah");
    expect(kpi("Registered").getByText("480")).toBeInTheDocument();
    expect(kpi("Registered").getByText("of 600 seats")).toBeInTheDocument();
    expect(kpi("Checked in").getByText("213")).toBeInTheDocument();
    expect(
      kpi("Checked in").getByText("on any day · 44% of registered"),
    ).toBeInTheDocument();
    expect(kpi("Pending").getByText("267")).toBeInTheDocument();
    expect(kpi("Cancelled").getByText("17")).toBeInTheDocument();
  });

  it("says 'no seat limit' for an event without a capacity", async () => {
    renderList({ capacity: null });
    await screen.findByText("Priya Shah");

    expect(kpi("Registered").getByText("no seat limit")).toBeInTheDocument();
  });

  it("shows each person: email, ticket code, registered on (event's zone), status and check-in", async () => {
    renderList();
    await screen.findByText("Priya Shah");

    const rows = screen.getAllByRole("row").slice(1);
    const [first, second, third] = rows.map((row) => within(row));
    expect(first!.getByText("priya.shah@example.com")).toBeInTheDocument();
    expect(first!.getByText("ESEVT1Y6D4S")).toBeInTheDocument();
    expect(first!.getByText("Mon 2 Nov 2026, 14:19")).toBeInTheDocument();
    expect(first!.getByText("Fri 4 Dec 2026, 09:41")).toBeInTheDocument();
    expect(first!.getByText("by Omkar Patil · manual")).toBeInTheDocument();

    expect(second!.getByText("Not checked in")).toBeInTheDocument();

    expect(third!.getByText("Cancelled")).toBeInTheDocument();
    expect(third!.getByText("Not applicable")).toBeInTheDocument();
  });

  it("tells checked-in, registered and cancelled people apart by their status badge", async () => {
    renderList();
    await screen.findByText("Priya Shah");

    const [first, second, third] = screen
      .getAllByRole("row")
      .slice(1)
      .map((row) => within(row));
    // Priya checked in, Amit only registered, Sandeep cancelled.
    expect(first!.getByText("Checked in")).toBeInTheDocument();
    expect(first!.queryByText("Registered")).toBeNull();
    expect(second!.getByText("Registered")).toBeInTheDocument();
    expect(second!.queryByText("Checked in")).toBeNull();
    expect(third!.getByText("Cancelled")).toBeInTheDocument();
  });

  it("shows the session bookings and the average per registered person", async () => {
    renderList();
    await screen.findByText("Priya Shah");

    expect(kpi("Session bookings").getByText("1,286")).toBeInTheDocument();
    // 1286 / 480 = 2.68.
    expect(
      kpi("Session bookings").getByText("average 2.7 per attendee"),
    ).toBeInTheDocument();
  });

  it("shows the controls the API does not have yet, switched off and marked Static", async () => {
    renderList();
    await screen.findByText("Priya Shah");

    expect(screen.getByLabelText("Session")).toBeDisabled();
    const exportButton = screen.getByRole("button", { name: "Export CSV" });
    expect(exportButton).toBeDisabled();
    // The Static badge sits next to them.
    expect(
      within(exportButton.parentElement!).getByText("Static"),
    ).toBeInTheDocument();
  });

  it("pages through the results the server counted", async () => {
    api.listEventAttendees.mockResolvedValue(
      answer([priya, amit], { total: 25 }),
    );
    renderList();
    await screen.findByText("Priya Shah");

    expect(screen.getByText(/Showing 1–2 of 25/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /next/i }));

    expect(lastQuery()).toMatchObject({ page: 2 });
  });
});

describe("EventAttendeeList: search, filters and sort (all asked of the server)", () => {
  it("searches once typing stops, from page 1", async () => {
    renderList();
    await screen.findByText("Priya Shah");

    await userEvent.type(
      screen.getByRole("searchbox", {
        name: "Search by name, email or ticket code",
      }),
      "  ESEVT9  ",
    );

    await waitFor(() =>
      expect(lastQuery()).toMatchObject({ search: "ESEVT9", page: 1 }),
    );
  });

  it.each([
    ["Status", "cancelled", { status: "cancelled" }],
    ["Checked in", "no", { checkedIn: "no" }],
    ["Sort", "checkedIn", { sort: "checkedIn" }],
  ])("asks again when %s changes, from page 1", async (label, value, sent) => {
    api.listEventAttendees.mockResolvedValue(answer([priya], { total: 30 }));
    renderList();
    await screen.findByText("Priya Shah");
    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => expect(lastQuery()).toMatchObject({ page: 2 }));

    await userEvent.selectOptions(screen.getByLabelText(label), value);

    expect(lastQuery()).toMatchObject({ ...sent, page: 1 });
  });

  it("shows the skeleton for a new query, never the old rows", async () => {
    renderList();
    await screen.findByText("Priya Shah");

    api.listEventAttendees.mockReturnValue(new Promise(() => {}));
    await userEvent.selectOptions(screen.getByLabelText("Status"), "cancelled");

    expect(
      screen.getByRole("status", { name: "Loading attendees" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Priya Shah")).toBeNull();
    // The count cards keep their numbers: they do not depend on the filters.
    expect(kpi("Registered").getByText("480")).toBeInTheDocument();
  });

  it("does not ask for the counts again on a search, a filter, a sort or a page", async () => {
    api.listEventAttendees.mockResolvedValue(answer([priya], { total: 30 }));
    renderList();
    await screen.findByText("Priya Shah");
    expect(countQueries()).toHaveLength(1);

    await userEvent.selectOptions(screen.getByLabelText("Status"), "cancelled");
    await userEvent.selectOptions(screen.getByLabelText("Checked in"), "no");
    await userEvent.selectOptions(screen.getByLabelText("Sort"), "name");
    await userEvent.type(
      screen.getByRole("searchbox", {
        name: "Search by name, email or ticket code",
      }),
      "priya",
    );
    await waitFor(() => expect(lastQuery()).toMatchObject({ search: "priya" }));
    await screen.findByText("Priya Shah");
    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => expect(lastQuery()).toMatchObject({ page: 2 }));

    // Rows were asked for many times; the counts only once, for every day, unfiltered.
    expect(countQueries()).toEqual([
      {
        page: 1,
        pageSize: 1,
        status: "all",
        checkedIn: "all",
        sort: "newest",
        date: undefined,
      },
    ]);
    expect(rowQueries().length).toBeGreaterThan(4);
  });
});

describe("EventAttendeeList: event day (multi-day events)", () => {
  it("offers every day of the event, and the day changes the counts and the check-in column", async () => {
    renderList();
    await screen.findByText("Priya Shah");

    const picker = screen.getByLabelText("Event day");
    expect(
      within(picker)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["All days", "Thu 3 Dec", "Fri 4 Dec", "Sat 5 Dec"]);

    await userEvent.selectOptions(picker, "2026-12-04");

    expect(lastQuery()).toMatchObject({ date: "2026-12-04", page: 1 });
    // A day is the one change that changes what the counts mean: they are asked for again.
    await waitFor(() =>
      expect(countQueries().at(-1)).toMatchObject({ date: "2026-12-04" }),
    );
    await screen.findByText("Priya Shah");
    expect(
      screen.getByRole("columnheader", { name: "Checked in on Fri 4 Dec" }),
    ).toBeInTheDocument();
    expect(
      kpi("Checked in").getByText("Fri 4 Dec · 44% of registered"),
    ).toBeInTheDocument();
    expect(
      kpi("Pending").getByText("Registered, not checked in on Fri 4 Dec"),
    ).toBeInTheDocument();
  });

  it("has no day picker for a one-day event", async () => {
    renderList({ endAt: "2026-12-03T12:30:00.000Z" });
    await screen.findByText("Priya Shah");

    expect(screen.queryByLabelText("Event day")).toBeNull();
  });
});

describe("EventAttendeeList: no door here", () => {
  it("has no check-in form: letting people in is the Check-in tab", async () => {
    renderList();
    await screen.findByText("Priya Shah");

    expect(screen.queryByRole("textbox", { name: "Ticket code" })).toBeNull();
    expect(screen.queryByText("Check in at the door")).toBeNull();
  });
});

describe("EventAttendeeList: empty and failed", () => {
  it("says nobody has registered yet", async () => {
    api.listEventAttendees.mockResolvedValue(
      answer([], {
        counts: { registered: 0, cancelled: 0, checkedIn: 0, pending: 0 },
      }),
    );
    renderList();

    expect(
      await screen.findByText("Nobody has registered yet."),
    ).toBeInTheDocument();
    expect(kpi("Checked in").getByText(/0% of registered/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Clear/ })).toBeNull();
  });

  it("says no one matches the filters, and clears them", async () => {
    renderList();
    await screen.findByText("Priya Shah");
    api.listEventAttendees.mockResolvedValue(answer([]));
    await userEvent.selectOptions(screen.getByLabelText("Checked in"), "yes");
    await screen.findByText("No attendee matches these filters.");

    api.listEventAttendees.mockResolvedValue(answer([priya]));
    await userEvent.click(
      screen.getByRole("button", { name: "Clear search and filters" }),
    );

    expect(lastQuery()).toMatchObject({
      checkedIn: "all",
      status: "all",
      search: "",
    });
    expect(await screen.findByText("Priya Shah")).toBeInTheDocument();
  });

  it("shows a failure with a way to try again", async () => {
    api.listEventAttendees.mockRejectedValueOnce(
      new ApiError(503, "SERVICE_UNAVAILABLE", "Service unavailable"),
    );
    renderList();

    expect(
      await screen.findByText("We couldn't load the registrations"),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Priya Shah")).toBeInTheDocument();
  });

  it("explains a 403 and offers no retry (trying again cannot help)", async () => {
    api.listEventAttendees.mockRejectedValue(
      new ApiError(403, "FORBIDDEN", "Forbidden"),
    );
    renderList();

    expect(
      await screen.findByText(
        /This account cannot see this event's registrations/,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });
});

describe("EventAttendeeList: Refresh", () => {
  afterEach(() => jest.useRealTimers());

  /** 4 Dec 09:41 IST: the rows arrive "now". */
  function at0941() {
    jest.useFakeTimers({
      now: new Date("2026-12-04T04:11:00.000Z"),
      advanceTimers: true,
    });
    return userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  }

  it("says when the list was last updated, in the event's zone", async () => {
    at0941();
    renderList();
    await screen.findByText("Priya Shah");

    expect(screen.getByText("Updated 09:41")).toBeInTheDocument();
  });

  it("asks again for the rows AND the counts, and keeps the rows on screen meanwhile", async () => {
    const user = at0941();
    renderList();
    await screen.findByText("Priya Shah");
    const rowsBefore = rowQueries().length;
    const countsBefore = countQueries().length;

    // The next answers wait (rows and counts: two requests), so the "while refreshing" moment
    // can be looked at.
    const waiting: ((value: ReturnType<typeof answer>) => void)[] = [];
    api.listEventAttendees.mockImplementation(
      () =>
        new Promise((resolve) => {
          waiting.push(resolve);
        }),
    );
    await user.click(screen.getByRole("button", { name: "Refresh" }));

    expect(await screen.findByText("Refreshing…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled();
    // No skeleton: the same query, so its rows stay until the new ones come.
    expect(screen.getByText("Priya Shah")).toBeInTheDocument();
    expect(rowQueries().length).toBeGreaterThan(rowsBefore);
    expect(countQueries().length).toBeGreaterThan(countsBefore);

    const fresh = answer([priya, amit, sandeep], {
      counts: { ...COUNTS, checkedIn: 214, pending: 266 },
    });
    waiting.forEach((resolve) => resolve(fresh));

    expect(await kpi("Checked in").findByText("214")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).not.toBeDisabled();
  });

  it("keeps the rows if a refresh fails, and says they are the earlier ones", async () => {
    const user = at0941();
    renderList();
    await screen.findByText("Priya Shah");

    api.listEventAttendees.mockRejectedValue(
      new ApiError(0, "NETWORK_ERROR", "Could not reach the server"),
    );
    await user.click(screen.getByRole("button", { name: "Refresh" }));

    expect(
      await screen.findByText("Couldn't refresh. Showing the list from 09:41."),
    ).toBeInTheDocument();
    expect(screen.getByText("Priya Shah")).toBeInTheDocument();
    expect(screen.queryByText("We couldn't load the registrations")).toBeNull();
  });
});
