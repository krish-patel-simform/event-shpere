/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { registrationApiService } from "../../api/registration-api.service";
import type {
  SessionAttendeeCounts,
  SessionAttendeeDto,
} from "../../schemas/attendees.schemas";
import {
  SessionAttendeeList,
  type AttendeeListSession,
} from "../SessionAttendeeList";

jest.mock("../../api/registration-api.service", () => ({
  registrationApiService: { listSessionAttendees: jest.fn() },
}));
const api = jest.mocked(registrationApiService);

const EVENT_ID = "6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d";
const SESSION_ID = "3f2b8a10-6c4d-4e57-8b19-0a1d2c3e4f01";

const session = (
  overrides: Partial<AttendeeListSession> = {},
): AttendeeListSession => ({
  eventId: EVENT_ID,
  sessionId: SESSION_ID,
  timezone: "Asia/Kolkata",
  hallCapacity: 300,
  // 3 Dec 10:00–10:45 IST, in Hall B of a published event.
  door: {
    status: "scheduled",
    startAt: "2026-12-03T04:30:00.000Z",
    endAt: "2026-12-03T05:15:00.000Z",
    eventStatus: "published",
    place: "Hall B",
  },
  eventDoorHref: `/organizer/events/${EVENT_ID}/attendees`,
  ...overrides,
});

const priya: SessionAttendeeDto = {
  bookingId: "7d8e9f0a-1b2c-4d3e-8f4a-000000000001",
  firstName: "Priya",
  lastName: "Shah",
  email: "priya.shah@example.com",
  ticketCode: "ESEVT1Y6D4S",
  status: "registered",
  // 5 Nov 10:12 IST.
  bookedAt: "2026-11-05T04:42:00.000Z",
  // 3 Dec 09:58 IST.
  checkedInAt: "2026-12-03T04:28:00.000Z",
};
const neha: SessionAttendeeDto = {
  ...priya,
  bookingId: "7d8e9f0a-1b2c-4d3e-8f4a-000000000002",
  firstName: "Neha",
  lastName: "Kapoor",
  email: "neha.kapoor@example.com",
  ticketCode: "ESEVT4M2X8L",
  checkedInAt: null,
};
const sandeep: SessionAttendeeDto = {
  ...neha,
  bookingId: "7d8e9f0a-1b2c-4d3e-8f4a-000000000003",
  firstName: "Sandeep",
  lastName: "Kulkarni",
  email: "sandeep.k@example.com",
  ticketCode: "ESEVT6H7Q3D",
  status: "cancelled",
};

const COUNTS: SessionAttendeeCounts = {
  registered: 248,
  cancelled: 12,
  checkedIn: 61,
  pending: 187,
};

const answer = (items: SessionAttendeeDto[], total = items.length) => ({
  items,
  meta: {
    page: 1,
    pageSize: 10,
    total,
    counts: COUNTS,
    checkInOpensHoursBefore: 8760,
  },
});

function renderList(overrides: Partial<AttendeeListSession> = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SessionAttendeeList session={session(overrides)} />
    </QueryClientProvider>,
  );
}

const kpi = (label: string) =>
  within(screen.getByText(label, { selector: "p" }).parentElement!);
const calls = () =>
  api.listSessionAttendees.mock.calls.map(([, , params]) => params);
const rowQueries = () => calls().filter((params) => params.pageSize !== 1);
const countQueries = () => calls().filter((params) => params.pageSize === 1);
const lastQuery = () => rowQueries().at(-1);

beforeEach(() => {
  jest.resetAllMocks();
  api.listSessionAttendees.mockResolvedValue(answer([priya, neha, sandeep]));
});

describe("SessionAttendeeList: the session's check-in door", () => {
  afterEach(() => jest.useRealTimers());

  it("opens with the setting route 10 sends (2 hours before the start, in production)", async () => {
    // 3 Dec 08:30 IST: 1.5 hours before 10:00.
    jest.useFakeTimers({
      now: new Date("2026-12-03T03:00:00.000Z"),
      advanceTimers: true,
    });
    api.listSessionAttendees.mockResolvedValue({
      ...answer([priya]),
      meta: { ...answer([priya]).meta, checkInOpensHoursBefore: 2 },
    });
    renderList();

    expect(
      await screen.findByRole("textbox", { name: "Ticket code" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Check in at this session")).toBeInTheDocument();
  });

  it("is shut for a cancelled session", async () => {
    renderList({
      door: { ...session().door, status: "cancelled" },
    });

    expect(
      await screen.findByText("This session was cancelled"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Ticket code" })).toBeNull();
  });
});

describe("SessionAttendeeList", () => {
  it("asks route 10 for the first page of every seat, newest booking first", async () => {
    renderList();

    expect(
      screen.getByRole("status", { name: "Loading session attendees" }),
    ).toBeInTheDocument();
    expect(api.listSessionAttendees).toHaveBeenCalledWith(
      EVENT_ID,
      SESSION_ID,
      {
        page: 1,
        pageSize: 10,
        status: "all",
        checkedIn: "all",
        sort: "newest",
        search: "",
      },
    );
    await screen.findByText("Priya Shah");
  });

  it("shows the seat counts, with the hall's capacity", async () => {
    renderList();
    await screen.findByText("Priya Shah");

    expect(kpi("Seats booked").getByText("248")).toBeInTheDocument();
    expect(kpi("Seats booked").getByText("of 300 seats")).toBeInTheDocument();
    expect(kpi("Checked in").getByText("61")).toBeInTheDocument();
    // 61 / 248 = 24.6%.
    expect(
      kpi("Checked in").getByText("at this session · 25%"),
    ).toBeInTheDocument();
    expect(kpi("Pending").getByText("187")).toBeInTheDocument();
    expect(kpi("Cancelled").getByText("12")).toBeInTheDocument();
  });

  it.each([
    [null, "no seat limit"],
    [undefined, "seats in this session"],
  ])("says %s capacity as '%s'", async (hallCapacity, note) => {
    renderList({ hallCapacity });
    await screen.findByText("Priya Shah");

    expect(kpi("Seats booked").getByText(note)).toBeInTheDocument();
  });

  it("shows each seat: event ticket code, booked on, a three-colour status and the check-in time", async () => {
    renderList();
    await screen.findByText("Priya Shah");

    const [first, second, third] = screen
      .getAllByRole("row")
      .slice(1)
      .map((row) => within(row));
    expect(first!.getByText("ESEVT1Y6D4S")).toBeInTheDocument();
    expect(first!.getByText("Thu 5 Nov 2026, 10:12")).toBeInTheDocument();
    expect(first!.getByText("Checked in")).toBeInTheDocument();
    expect(first!.getByText("Thu 3 Dec 2026, 09:58")).toBeInTheDocument();
    expect(second!.getByText("Registered")).toBeInTheDocument();
    expect(second!.getByText("Not checked in")).toBeInTheDocument();
    expect(third!.getByText("Cancelled")).toBeInTheDocument();
    expect(third!.getByText("Not applicable")).toBeInTheDocument();
  });

  it("filters, sorts and searches on the server from page 1, and never asks for the counts again", async () => {
    api.listSessionAttendees.mockResolvedValue(answer([priya], 30));
    renderList();
    await screen.findByText("Priya Shah");
    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => expect(lastQuery()).toMatchObject({ page: 2 }));

    await userEvent.selectOptions(screen.getByLabelText("Checked in"), "no");
    expect(lastQuery()).toMatchObject({ checkedIn: "no", page: 1 });
    await userEvent.selectOptions(screen.getByLabelText("Sort"), "checkedIn");
    expect(lastQuery()).toMatchObject({ sort: "checkedIn" });
    await userEvent.type(
      screen.getByRole("searchbox", {
        name: "Search by name, email or ticket code",
      }),
      "neha",
    );
    await waitFor(() => expect(lastQuery()).toMatchObject({ search: "neha" }));

    expect(countQueries()).toHaveLength(1);
    expect(kpi("Seats booked").getByText("248")).toBeInTheDocument();
  });

  it("offers 'Booked' sort labels (not 'Registered')", async () => {
    renderList();
    await screen.findByText("Priya Shah");

    const sort = within(screen.getByLabelText("Sort"));
    expect(
      sort.getByRole("option", { name: "Booked: newest first" }),
    ).toBeInTheDocument();
    expect(
      sort.getByRole("option", { name: "Booked: oldest first" }),
    ).toBeInTheDocument();
  });

  it("says nobody has booked yet, or that nothing matches (with Clear)", async () => {
    api.listSessionAttendees.mockResolvedValue(answer([]));
    renderList();
    expect(
      await screen.findByText("Nobody has booked a seat yet."),
    ).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Status"), "cancelled");
    expect(
      await screen.findByText("No seat matches these filters."),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Clear search and filters" }),
    );
    expect(lastQuery()).toMatchObject({ status: "all" });
  });

  it("shows a failure with Try again, and a 403 without it", async () => {
    api.listSessionAttendees.mockRejectedValueOnce(
      new ApiError(503, "SERVICE_UNAVAILABLE", "Service unavailable"),
    );
    renderList();
    await screen.findByText("We couldn't load who booked this session");
    api.listSessionAttendees.mockResolvedValue(answer([priya]));
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Priya Shah")).toBeInTheDocument();
  });

  it("explains a 403 with no retry", async () => {
    api.listSessionAttendees.mockRejectedValue(
      new ApiError(403, "FORBIDDEN", "Forbidden"),
    );
    renderList();

    expect(
      await screen.findByText(/cannot see this session's attendees/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });
});

describe("SessionAttendeeList: Refresh", () => {
  it("asks route 10 again for the seats and the counts, and shows the new ones", async () => {
    renderList();
    await screen.findByText("Priya Shah");
    const before = api.listSessionAttendees.mock.calls.length;

    api.listSessionAttendees.mockResolvedValue(answer([priya]));
    await userEvent.click(screen.getByRole("button", { name: "Refresh" }));

    // The rows' query and the counts' query both ask again.
    await waitFor(() =>
      expect(api.listSessionAttendees.mock.calls.length).toBeGreaterThanOrEqual(
        before + 2,
      ),
    );
    await waitFor(() => expect(screen.queryByText("Neha Kapoor")).toBeNull());
    expect(screen.getByText(/^Updated \d{2}:\d{2}$/)).toBeInTheDocument();
  });

  it("keeps the seats if a refresh fails, and says so", async () => {
    renderList();
    await screen.findByText("Priya Shah");

    api.listSessionAttendees.mockRejectedValue(
      new ApiError(503, "SERVICE_UNAVAILABLE", "Service unavailable"),
    );
    await userEvent.click(screen.getByRole("button", { name: "Refresh" }));

    expect(
      await screen.findByText(/^Couldn't refresh\. Showing the list from/),
    ).toBeInTheDocument();
    expect(screen.getByText("Priya Shah")).toBeInTheDocument();
  });
});
