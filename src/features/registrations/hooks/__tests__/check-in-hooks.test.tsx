/** @jest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApiError } from "../../../../core/api-client/base-api.service";
import { registrationApiService } from "../../api/registration-api.service";
import type {
  CheckInDto,
  SessionCheckInDto,
} from "../../schemas/check-ins.schemas";
import type { CheckInContext } from "../../utils/check-in-result";
import { registrationQueryKeys } from "../registration-cache";
import { useCheckInAtEvent } from "../useCheckInAtEvent";
import { useCheckInAtSession } from "../useCheckInAtSession";

jest.mock("../../api/registration-api.service", () => ({
  registrationApiService: {
    checkInAtEvent: jest.fn(),
    checkInAtSession: jest.fn(),
  },
}));
const api = jest.mocked(registrationApiService);

const EVENT_ID = "6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d";
const SESSION_ID = "3f2b8a10-6c4d-4e57-8b19-0a1d2c3e4f01";
const DAY_2: CheckInContext = {
  door: "event",
  date: "2026-12-04",
  dayLabel: "Fri 4 Dec",
  dayOfLabel: "Day 2 of 3",
};
const ATTENDEE = {
  firstName: "Priya",
  lastName: "Shah",
  ticketCode: "ESEVT1Y6D4S",
};
const EVENT_CHECK_IN: CheckInDto = {
  id: "0a1b2c3d-4e5f-4a6b-8c7d-000000000001",
  registrationId: "1b2c3d4e-5f6a-4b7c-8d9e-000000000001",
  attendanceDate: "2026-12-04",
  checkedInAt: "2026-12-04T04:11:00.000Z",
  method: "manual",
  attendee: ATTENDEE,
};
const SESSION_CHECK_IN: SessionCheckInDto = {
  id: "0a1b2c3d-4e5f-4a6b-8c7d-000000000002",
  sessionId: SESSION_ID,
  checkedInAt: "2026-12-03T04:28:00.000Z",
  method: "manual",
  attendee: ATTENDEE,
};

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const refresh = jest.spyOn(queryClient, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, refresh, wrapper };
}

beforeEach(() => jest.resetAllMocks());

describe("useCheckInAtEvent (route 6)", () => {
  it("sends the code and the context's day, and answers who came in", async () => {
    api.checkInAtEvent.mockResolvedValue(EVENT_CHECK_IN);
    const { wrapper } = setup();
    const { result } = renderHook(() => useCheckInAtEvent(EVENT_ID), {
      wrapper,
    });

    await expect(result.current("ESEVT1Y6D4S", DAY_2)).resolves.toEqual({
      ok: true,
      attendee: ATTENDEE,
      checkedInAt: "2026-12-04T04:11:00.000Z",
    });
    expect(api.checkInAtEvent).toHaveBeenCalledWith(EVENT_ID, {
      ticketCode: "ESEVT1Y6D4S",
      attendanceDate: "2026-12-04",
    });
  });

  it("refreshes the event's attendees, WITHOUT holding the answer until the refresh ends", async () => {
    api.checkInAtEvent.mockResolvedValue(EVENT_CHECK_IN);
    const { wrapper, refresh } = setup();
    // A refresh that never finishes: the answer must still come.
    refresh.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useCheckInAtEvent(EVENT_ID), {
      wrapper,
    });

    await expect(result.current("ESEVT1Y6D4S", DAY_2)).resolves.toMatchObject({
      ok: true,
    });
    expect(refresh).toHaveBeenCalledWith({
      queryKey: registrationQueryKeys.attendees(EVENT_ID),
    });
  });

  it("answers a refusal as a row (never throws), with the server's status, code and words", async () => {
    api.checkInAtEvent.mockRejectedValue(
      new ApiError(409, "ALREADY_CHECKED_IN", "Already checked in"),
    );
    const { wrapper } = setup();
    const { result } = renderHook(() => useCheckInAtEvent(EVENT_ID), {
      wrapper,
    });

    await expect(result.current("ESEVT1Y6D4S", DAY_2)).resolves.toEqual({
      ok: false,
      status: 409,
      code: "ALREADY_CHECKED_IN",
      message: "Already checked in",
    });
  });

  it("refreshes the lists after a 409 (the screen was out of date), not after a 404", async () => {
    const { wrapper, refresh } = setup();
    const { result } = renderHook(() => useCheckInAtEvent(EVENT_ID), {
      wrapper,
    });

    api.checkInAtEvent.mockRejectedValueOnce(
      new ApiError(404, "NOT_FOUND", "Ticket not found"),
    );
    await result.current("NOPE", DAY_2);
    expect(refresh).not.toHaveBeenCalled();

    api.checkInAtEvent.mockRejectedValueOnce(
      new ApiError(409, "REGISTRATION_CANCELLED", "Cancelled"),
    );
    await result.current("ESEVT6H7Q3D", DAY_2);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("answers 'no answer' (status 0) when the server cannot be reached", async () => {
    api.checkInAtEvent.mockRejectedValue(
      new ApiError(0, "NETWORK_ERROR", "Could not reach the server"),
    );
    const { wrapper } = setup();
    const { result } = renderHook(() => useCheckInAtEvent(EVENT_ID), {
      wrapper,
    });

    await expect(result.current("ESEVT1Y6D4S", DAY_2)).resolves.toMatchObject({
      ok: false,
      status: 0,
    });
  });
});

describe("useCheckInAtSession (route 11)", () => {
  it("sends only the code to the session's route, and answers who came in", async () => {
    api.checkInAtSession.mockResolvedValue(SESSION_CHECK_IN);
    const { wrapper, refresh } = setup();
    const { result } = renderHook(
      () => useCheckInAtSession(EVENT_ID, SESSION_ID),
      { wrapper },
    );

    await expect(result.current("ESEVT1Y6D4S")).resolves.toEqual({
      ok: true,
      attendee: ATTENDEE,
      checkedInAt: "2026-12-03T04:28:00.000Z",
    });
    expect(api.checkInAtSession).toHaveBeenCalledWith(EVENT_ID, SESSION_ID, {
      ticketCode: "ESEVT1Y6D4S",
    });
    expect(refresh).toHaveBeenCalledWith({
      queryKey: registrationQueryKeys.attendees(EVENT_ID),
    });
  });

  it("answers the session's refusals as rows", async () => {
    api.checkInAtSession.mockRejectedValue(
      new ApiError(409, "SESSION_NOT_BOOKED", "No seat"),
    );
    const { wrapper } = setup();
    const { result } = renderHook(
      () => useCheckInAtSession(EVENT_ID, SESSION_ID),
      { wrapper },
    );

    await expect(result.current("ESEVT9J3W2C")).resolves.toMatchObject({
      ok: false,
      status: 409,
      code: "SESSION_NOT_BOOKED",
    });
  });
});
