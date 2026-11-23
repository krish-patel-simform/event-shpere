/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { registrationApiService } from "../../api/registration-api.service";
import { registrationQueryKeys } from "../../hooks/registration-cache";
import type {
  CheckInDto,
  SessionCheckInDto,
} from "../../schemas/check-ins.schemas";
import {
  EventCheckInDoor,
  SessionCheckInDoor,
  type EventDoorEvent,
  type SessionDoorSession,
} from "../CheckInDoors";

jest.mock("../../api/registration-api.service", () => ({
  registrationApiService: {
    checkInAtEvent: jest.fn(),
    checkInAtSession: jest.fn(),
  },
}));
const api = jest.mocked(registrationApiService);

const EVENT_ID = "6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d";
const SESSION_ID = "3f2b8a10-6c4d-4e57-8b19-0a1d2c3e4f01";
const PRIYA = {
  firstName: "Priya",
  lastName: "Shah",
  ticketCode: "ESEVT1Y6D4S",
};

// 3 Dec 09:00 IST – 5 Dec 18:00 IST.
const EVENT: EventDoorEvent = {
  id: EVENT_ID,
  startAt: "2026-12-03T03:30:00.000Z",
  endAt: "2026-12-05T12:30:00.000Z",
  timezone: "Asia/Kolkata",
  status: "published",
};
const PROD = 6;
const DEV = 24 * 365;

/**
 * A stand-in for routes 6 and 11 with the server's main rules: only Priya's code exists, and a
 * person is checked in once per event day (event door) or once per session.
 */
function fakeServer() {
  const done = new Set<string>();
  api.checkInAtEvent.mockImplementation(async (_eventId, body) => {
    if (body.ticketCode !== PRIYA.ticketCode) {
      throw new ApiError(404, "NOT_FOUND", "Ticket not found");
    }
    const key = `${body.ticketCode}|${body.attendanceDate}`;
    if (done.has(key)) {
      throw new ApiError(409, "ALREADY_CHECKED_IN", "Already checked in");
    }
    done.add(key);
    const checkIn: CheckInDto = {
      id: "0a1b2c3d-4e5f-4a6b-8c7d-000000000001",
      registrationId: "1b2c3d4e-5f6a-4b7c-8d9e-000000000001",
      attendanceDate: body.attendanceDate,
      checkedInAt: new Date().toISOString(),
      method: "manual",
      attendee: PRIYA,
    };
    return checkIn;
  });
  api.checkInAtSession.mockImplementation(
    async (_eventId, _sessionId, body) => {
      if (body.ticketCode === "ESEVT4M2X8L") {
        throw new ApiError(
          409,
          "EVENT_CHECK_IN_REQUIRED",
          "Check this person in at the event door first",
        );
      }
      if (body.ticketCode !== PRIYA.ticketCode) {
        throw new ApiError(404, "NOT_FOUND", "Ticket not found");
      }
      const checkIn: SessionCheckInDto = {
        id: "0a1b2c3d-4e5f-4a6b-8c7d-000000000002",
        sessionId: SESSION_ID,
        checkedInAt: new Date().toISOString(),
        method: "manual",
        attendee: PRIYA,
      };
      return checkIn;
    },
  );
}

let queryClient: QueryClient;

function renderWithClient(ui: ReactNode) {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

/** Sets the clock (it keeps ticking, so waits still work). */
function clockAt(iso: string) {
  jest.useFakeTimers({ now: new Date(iso), advanceTimers: true });
  return userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
}

beforeEach(() => {
  jest.resetAllMocks();
  fakeServer();
});
afterEach(() => jest.useRealTimers());

const daySelect = () =>
  screen.getByRole("combobox", { name: "Checking in for" });
const option = (name: RegExp) => screen.getByRole("option", { name });
const codeBox = () => screen.getByRole("textbox", { name: "Ticket code" });

describe("EventCheckInDoor: the day it checks in for", () => {
  it("picks the running day; the others are switched off, saying when they open or that they closed", () => {
    // 4 Dec 08:00 IST: day 2 is running.
    clockAt("2026-12-04T02:30:00.000Z");
    renderWithClient(
      <EventCheckInDoor event={EVENT} opensHoursBefore={PROD} />,
    );

    expect(daySelect()).toHaveValue("2026-12-04");
    expect(option(/^Thu 3 Dec \(closed\)$/)).toBeDisabled();
    expect(option(/^Fri 4 Dec$/)).toBeEnabled();
    expect(
      option(/^Sat 5 Dec \(opens Sat 5 Dec 2026, 03:00\)$/),
    ).toBeDisabled();
    expect(screen.getByText("Check-in open")).toBeInTheDocument();
  });

  it("is real now: no Static badge and no sample codes", () => {
    clockAt("2026-12-04T02:30:00.000Z");
    renderWithClient(
      <EventCheckInDoor event={EVENT} opensHoursBefore={PROD} />,
    );

    expect(screen.queryByText("Static")).toBeNull();
    expect(screen.queryByText(/Sample answers/)).toBeNull();
  });
});

describe("EventCheckInDoor: route 6", () => {
  it("sends the code and the running day, and shows who came in on which day", async () => {
    const user = clockAt("2026-12-04T02:30:00.000Z");
    renderWithClient(
      <EventCheckInDoor event={EVENT} opensHoursBefore={PROD} />,
    );

    await user.type(codeBox(), "esevt1y6d4s{Enter}");

    expect(await screen.findByText("Priya Shah")).toBeInTheDocument();
    expect(api.checkInAtEvent).toHaveBeenCalledWith(EVENT_ID, {
      ticketCode: "ESEVT1Y6D4S",
      attendanceDate: "2026-12-04",
    });
    // The day is the row's chip.
    expect(screen.getByText("Fri 4 Dec · Day 2 of 3")).toBeInTheDocument();
  });

  it("refreshes the attendee counts and lists after a check-in", async () => {
    const user = clockAt("2026-12-04T02:30:00.000Z");
    renderWithClient(
      <EventCheckInDoor event={EVENT} opensHoursBefore={PROD} />,
    );
    const refresh = jest.spyOn(queryClient, "invalidateQueries");

    await user.type(codeBox(), "ESEVT1Y6D4S{Enter}");
    await screen.findByText("Priya Shah");

    expect(refresh).toHaveBeenCalledWith({
      queryKey: registrationQueryKeys.attendees(EVENT_ID),
    });
  });

  it("shows the server's 'already checked in' for the same code twice on one day", async () => {
    const user = clockAt("2026-12-04T02:30:00.000Z");
    renderWithClient(
      <EventCheckInDoor event={EVENT} opensHoursBefore={PROD} />,
    );

    await user.type(codeBox(), "ESEVT1Y6D4S{Enter}");
    await screen.findByText("Priya Shah");
    await user.type(codeBox(), "ESEVT1Y6D4S{Enter}");

    expect(
      await screen.findByText("Already checked in for this day"),
    ).toBeInTheDocument();
  });

  it("in dev, sends the later day the staff picked", async () => {
    const user = clockAt("2026-11-20T10:00:00.000Z");
    renderWithClient(<EventCheckInDoor event={EVENT} opensHoursBefore={DEV} />);

    await user.selectOptions(daySelect(), "2026-12-05");
    await user.type(codeBox(), "ESEVT1Y6D4S{Enter}");

    expect(
      await screen.findByText("Sat 5 Dec · Day 3 of 3"),
    ).toBeInTheDocument();
    expect(api.checkInAtEvent).toHaveBeenCalledWith(
      EVENT_ID,
      expect.objectContaining({ attendanceDate: "2026-12-05" }),
    );
  });

  it("offers Try again when the server could not be reached, and the retry checks them in", async () => {
    const user = clockAt("2026-12-04T02:30:00.000Z");
    api.checkInAtEvent.mockRejectedValueOnce(
      new ApiError(0, "NETWORK_ERROR", "Could not reach the server"),
    );
    renderWithClient(
      <EventCheckInDoor event={EVENT} opensHoursBefore={PROD} />,
    );

    await user.type(codeBox(), "ESEVT1Y6D4S{Enter}");
    await user.click(
      await screen.findByRole("button", { name: "Try ESEVT1Y6D4S again" }),
    );

    expect(await screen.findByText("Priya Shah")).toBeInTheDocument();
    expect(api.checkInAtEvent).toHaveBeenCalledTimes(2);
  });

  it("says 'Ticket not found' for an unknown code, without Try again", async () => {
    const user = clockAt("2026-12-04T02:30:00.000Z");
    renderWithClient(
      <EventCheckInDoor event={EVENT} opensHoursBefore={PROD} />,
    );

    await user.type(codeBox(), "NOPE{Enter}");

    expect(await screen.findByText("Ticket not found")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /again/ })).toBeNull();
  });

  it("has no day picker on a one-day event", () => {
    clockAt("2026-12-03T04:00:00.000Z");
    renderWithClient(
      <EventCheckInDoor
        event={{ ...EVENT, endAt: "2026-12-03T12:30:00.000Z" }}
        opensHoursBefore={PROD}
      />,
    );

    expect(
      screen.queryByRole("combobox", { name: "Checking in for" }),
    ).toBeNull();
    expect(codeBox()).toBeInTheDocument();
  });
});

describe("EventCheckInDoor: a shut door has no code box and says why", () => {
  const shut = (title: string) => {
    expect(screen.queryByRole("textbox", { name: "Ticket code" })).toBeNull();
    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getByText("Check-in closed")).toBeInTheDocument();
    expect(api.checkInAtEvent).not.toHaveBeenCalled();
  };

  it("before the first day opens: when it opens", () => {
    clockAt("2026-12-01T00:00:00.000Z");
    renderWithClient(
      <EventCheckInDoor event={EVENT} opensHoursBefore={PROD} />,
    );

    shut("Check-in is not open yet");
    expect(
      screen.getByText(
        "It opens Thu 3 Dec 2026, 03:00, 6 hours before the day starts.",
      ),
    ).toBeInTheDocument();
    expect(daySelect()).toBeDisabled();
  });

  it("after the last day", () => {
    clockAt("2026-12-06T00:00:00.000Z");
    renderWithClient(
      <EventCheckInDoor event={EVENT} opensHoursBefore={PROD} />,
    );

    shut("Check-in is closed");
  });

  it.each([
    ["draft", "This event is still a draft"],
    ["cancelled", "This event was cancelled"],
    ["completed", "Check-in is closed"],
  ] as const)("a %s event", (status, title) => {
    clockAt("2026-12-04T02:30:00.000Z");
    renderWithClient(
      <EventCheckInDoor event={{ ...EVENT, status }} opensHoursBefore={PROD} />,
    );

    shut(title);
  });

  it("while the door's hours load (route 5's meta)", () => {
    clockAt("2026-12-04T02:30:00.000Z");
    renderWithClient(
      <EventCheckInDoor event={EVENT} opensHoursBefore={null} />,
    );

    shut("Loading the door's hours");
  });
});

describe("SessionCheckInDoor: route 11", () => {
  // 3 Dec 10:00–10:45 IST, Hall B.
  const SESSION: SessionDoorSession = {
    status: "scheduled",
    startAt: "2026-12-03T04:30:00.000Z",
    endAt: "2026-12-03T05:15:00.000Z",
    eventStatus: "published",
    place: "Hall B",
  };
  const HREF = `/organizer/events/${EVENT_ID}/attendees`;
  const renderDoor = (
    session: Partial<SessionDoorSession> = {},
    hours: number | null = 2,
  ) =>
    renderWithClient(
      <SessionCheckInDoor
        eventId={EVENT_ID}
        sessionId={SESSION_ID}
        session={{ ...SESSION, ...session }}
        timezone="Asia/Kolkata"
        opensHoursBefore={hours}
        eventDoorHref={HREF}
      />,
    );

  it("sends ONLY the code to this session's route, and names the hall", async () => {
    // 3 Dec 09:58 IST.
    const user = clockAt("2026-12-03T04:28:00.000Z");
    renderDoor();

    await user.type(codeBox(), "ESEVT1Y6D4S{Enter}");

    expect(
      await screen.findByText("Checked in to this session"),
    ).toBeInTheDocument();
    expect(api.checkInAtSession).toHaveBeenCalledWith(EVENT_ID, SESSION_ID, {
      ticketCode: "ESEVT1Y6D4S",
    });
    // The place is the row's chip.
    expect(
      within(screen.getByRole("list", { name: "Check-in results" })).getByText(
        "Hall B",
      ),
    ).toBeInTheDocument();
  });

  it("refreshes the seat list and counts after a check-in", async () => {
    const user = clockAt("2026-12-03T04:28:00.000Z");
    renderDoor();
    const refresh = jest.spyOn(queryClient, "invalidateQueries");

    await user.type(codeBox(), "ESEVT1Y6D4S{Enter}");
    await screen.findByText("Checked in to this session");

    // The session's keys sit under the event's attendees key.
    expect(refresh).toHaveBeenCalledWith({
      queryKey: registrationQueryKeys.attendees(EVENT_ID),
    });
  });

  it("sends someone who skipped the event door back there, with a link", async () => {
    const user = clockAt("2026-12-03T04:28:00.000Z");
    renderDoor();

    await user.type(codeBox(), "ESEVT4M2X8L{Enter}");

    const row = (
      await screen.findByText("Check them in at the event door first")
    ).closest("li")!;
    expect(
      within(row).getByRole("link", { name: "Check in at the event door" }),
    ).toHaveAttribute("href", HREF);
  });

  it("says when it opens (2 hours before the start), and sends nothing", () => {
    clockAt("2026-12-03T02:00:00.000Z");
    renderDoor();

    expect(
      screen.getByText(
        "It opens Thu 3 Dec 2026, 08:00, 2 hours before the session starts, and closes when it ends.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Ticket code" })).toBeNull();
  });

  it.each([
    [{}, "2026-12-03T05:15:00.000Z", "Session check-in is closed"],
    [{ status: "cancelled" as const }, undefined, "This session was cancelled"],
    [
      { status: "draft" as const, startAt: null, endAt: null },
      undefined,
      "This session is not scheduled",
    ],
    [
      { eventStatus: "draft" as const },
      undefined,
      "This event is still a draft",
    ],
    [
      { eventStatus: "cancelled" as const },
      undefined,
      "This event was cancelled",
    ],
  ])("is shut: %o → %s", async (session, now, title) => {
    clockAt(now ?? "2026-12-03T04:28:00.000Z");
    renderDoor(session);

    expect(screen.queryByRole("textbox", { name: "Ticket code" })).toBeNull();
    expect(screen.getByText(title)).toBeInTheDocument();
    await waitFor(() => expect(api.checkInAtSession).not.toHaveBeenCalled());
  });
});
