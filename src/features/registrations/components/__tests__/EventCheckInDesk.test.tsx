/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { registrationApiService } from "../../api/registration-api.service";
import type { AttendeeCounts } from "../../schemas/attendees.schemas";
import type { EventDoorEvent } from "../CheckInDoors";
import { EventCheckInDesk } from "../EventCheckInDesk";

jest.mock("../../api/registration-api.service", () => ({
  registrationApiService: {
    listEventAttendees: jest.fn(),
    checkInAtEvent: jest.fn(),
  },
}));
const api = jest.mocked(registrationApiService);

const EVENT_ID = "6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d";

// 3 Dec 09:00 IST – 5 Dec 18:00 IST: three event days.
const EVENT: EventDoorEvent = {
  id: EVENT_ID,
  startAt: "2026-12-03T03:30:00.000Z",
  endAt: "2026-12-05T12:30:00.000Z",
  timezone: "Asia/Kolkata",
  status: "published",
};

const DAY_COUNTS: AttendeeCounts = {
  registered: 480,
  cancelled: 17,
  checkedIn: 213,
  pending: 267,
};

/** Route 5's meta (only the meta is read here), with the production setting (6 hours). */
function route5(counts: AttendeeCounts = DAY_COUNTS, opensHoursBefore = 6) {
  api.listEventAttendees.mockResolvedValue({
    items: [],
    meta: {
      page: 1,
      pageSize: 1,
      total: 0,
      counts,
      checkInOpensHoursBefore: opensHoursBefore,
    },
  });
}

function renderDesk(event: EventDoorEvent = EVENT) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <EventCheckInDesk event={event} />
    </QueryClientProvider>,
  );
}

/** The count card with this label. */
const kpi = (label: string) =>
  within(screen.getByText(label, { selector: "p" }).parentElement!);

/** 4 Dec 08:00 IST: day 2 of 3 is open with the production setting. */
function onDay2() {
  jest.useFakeTimers({
    now: new Date("2026-12-04T02:30:00.000Z"),
    advanceTimers: true,
  });
}

beforeEach(() => jest.resetAllMocks());
afterEach(() => jest.useRealTimers());

describe("EventCheckInDesk", () => {
  it("opens on the running day, using the setting route 5 sends", async () => {
    onDay2();
    route5();
    renderDesk();

    expect(
      await screen.findByRole("combobox", { name: "Checking in for" }),
    ).toHaveValue("2026-12-04");
    expect(
      screen.getByRole("textbox", { name: "Ticket code" }),
    ).toBeInTheDocument();
  });

  it("shows the counts of the day being checked in, asked for that day", async () => {
    onDay2();
    route5();
    renderDesk();
    await screen.findByText("Checked in on Fri 4 Dec");

    expect(
      await kpi("Checked in on Fri 4 Dec").findByText("213"),
    ).toBeInTheDocument();
    expect(kpi("Not checked in yet").getByText("267")).toBeInTheDocument();
    expect(kpi("Registered").getByText("480")).toBeInTheDocument();
    expect(api.listEventAttendees).toHaveBeenCalledWith(
      EVENT_ID,
      expect.objectContaining({ date: "2026-12-04", pageSize: 1 }),
    );
  });

  it("after a check-in, the day's counts refresh by themselves", async () => {
    onDay2();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    route5();
    renderDesk();
    await screen.findByText("Checked in on Fri 4 Dec");
    await kpi("Checked in on Fri 4 Dec").findByText("213");

    api.checkInAtEvent.mockResolvedValue({
      id: "0a1b2c3d-4e5f-4a6b-8c7d-000000000001",
      registrationId: "1b2c3d4e-5f6a-4b7c-8d9e-000000000002",
      attendanceDate: "2026-12-04",
      checkedInAt: "2026-12-04T02:31:00.000Z",
      method: "manual",
      attendee: {
        firstName: "Amit",
        lastName: "Verma",
        ticketCode: "ESEVT9J3W2C",
      },
    });
    route5({ ...DAY_COUNTS, checkedIn: 214, pending: 266 });
    await user.type(
      screen.getByRole("textbox", { name: "Ticket code" }),
      "ESEVT9J3W2C{Enter}",
    );

    expect(await screen.findByText("Amit Verma")).toBeInTheDocument();
    expect(api.checkInAtEvent).toHaveBeenCalledWith(EVENT_ID, {
      ticketCode: "ESEVT9J3W2C",
      attendanceDate: "2026-12-04",
    });
    expect(
      await kpi("Checked in on Fri 4 Dec").findByText("214"),
    ).toBeInTheDocument();
    expect(kpi("Not checked in yet").getByText("266")).toBeInTheDocument();
  });

  it("stays shut a week before with the production setting, with no day counts", async () => {
    jest.useFakeTimers({
      now: new Date("2026-11-26T00:00:00.000Z"),
      advanceTimers: true,
    });
    route5();
    renderDesk();

    expect(
      await screen.findByText("Check-in is not open yet"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Ticket code" })).toBeNull();
    expect(screen.queryByText("Not checked in yet")).toBeNull();
  });

  it("never opens for a draft event", async () => {
    route5();
    renderDesk({ ...EVENT, status: "draft" });

    expect(
      await screen.findByText("This event is still a draft"),
    ).toBeInTheDocument();
  });

  it("says so, with Try again, when the door's hours cannot be read", async () => {
    api.listEventAttendees.mockRejectedValueOnce(
      new ApiError(503, "SERVICE_UNAVAILABLE", "Service unavailable"),
    );
    renderDesk();

    expect(
      await screen.findByText("We couldn't open the check-in door"),
    ).toBeInTheDocument();

    onDay2();
    route5();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(
      await screen.findByRole("textbox", { name: "Ticket code" }),
    ).toBeInTheDocument();
  });

  it("explains a 403 and offers no retry", async () => {
    api.listEventAttendees.mockRejectedValue(
      new ApiError(403, "FORBIDDEN", "Forbidden"),
    );
    renderDesk();

    expect(
      await screen.findByText(/This account cannot check people in/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });
});
