/** @jest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApiError } from "../../../../core/api-client/base-api.service";
import { registrationApiService } from "../../api/registration-api.service";
import type {
  MyRegistrationDto,
  SessionBookingDto,
} from "../../schemas/registrations.schemas";
import {
  PUBLIC_SESSION_DETAILS_KEY,
  registrationQueryKeys,
} from "../registration-cache";
import { useBookSession } from "../useBookSession";
import { useCancelSessionBooking } from "../useCancelSessionBooking";

jest.mock("../../api/registration-api.service", () => ({
  registrationApiService: {
    bookSession: jest.fn(),
    cancelSessionBooking: jest.fn(),
  },
}));
const api = jest.mocked(registrationApiService);

const eventId = "6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d";
const sessionId = "3f2b8a10-6c4d-4e57-8b19-0a1d2c3e4f01";
const otherSessionId = "3f2b8a10-6c4d-4e57-8b19-0a1d2c3e4f02";
const sessionPageKey = [
  ...PUBLIC_SESSION_DETAILS_KEY,
  "summit",
  sessionId,
] as const;
const otherSessionPageKey = [
  ...PUBLIC_SESSION_DETAILS_KEY,
  "summit",
  otherSessionId,
] as const;
const mineKey = registrationQueryKeys.mine(eventId);

const booking = (status: "registered" | "cancelled"): SessionBookingDto => ({
  id: "7d8e9f0a-1b2c-4d3e-8f4a-5b6c7d8e9f0a",
  sessionId,
  status,
  registeredAt: "2026-11-12T10:00:00.000Z",
});

const standing = (bookedSessionIds: string[]): MyRegistrationDto => ({
  registration: {
    id: "1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e",
    eventId,
    status: "registered",
    ticketCode: "ESEVT7K3Q9P",
    amount: 0,
    currency: "INR",
    reason: "free",
    registeredAt: "2026-11-10T10:00:00.000Z",
  },
  bookedSessionIds,
});

/** A client holding this session's page (32 seats left), another session's page and the standing. */
function setup({
  mine = standing([otherSessionId]),
}: { mine?: MyRegistrationDto | null } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(sessionPageKey, { id: sessionId, seatsLeft: 32 });
  queryClient.setQueryData(otherSessionPageKey, {
    id: otherSessionId,
    seatsLeft: 10,
  });
  if (mine) queryClient.setQueryData(mineKey, mine);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const isStale = (key: readonly unknown[]) =>
    queryClient.getQueryState(key)?.isInvalidated === true;
  const seatsOf = (key: readonly unknown[]) =>
    queryClient.getQueryData<{ seatsLeft: number | null }>(key)?.seatsLeft;
  const booked = () =>
    queryClient.getQueryData<MyRegistrationDto>(mineKey)?.bookedSessionIds;
  return { queryClient, wrapper, isStale, seatsOf, booked };
}

beforeEach(() => jest.resetAllMocks());

describe("useBookSession", () => {
  it("books by event and session, marks the session booked and takes one seat, with no refetch", async () => {
    api.bookSession.mockResolvedValue(booking("registered"));
    const { wrapper, isStale, seatsOf, booked } = setup();
    const { result } = renderHook(() => useBookSession(eventId, sessionId), {
      wrapper,
    });

    await act(() => result.current.mutateAsync());

    expect(api.bookSession).toHaveBeenCalledWith(eventId, sessionId);
    expect(booked()).toEqual([otherSessionId, sessionId]);
    expect(seatsOf(sessionPageKey)).toBe(31);
    // Another session's seats are not touched.
    expect(seatsOf(otherSessionPageKey)).toBe(10);
    expect(isStale(mineKey)).toBe(false);
    expect(isStale(sessionPageKey)).toBe(false);
  });

  it("never lists the session twice", async () => {
    api.bookSession.mockResolvedValue(booking("registered"));
    const { wrapper, booked } = setup({ mine: standing([sessionId]) });
    const { result } = renderHook(() => useBookSession(eventId, sessionId), {
      wrapper,
    });

    await act(() => result.current.mutateAsync());

    expect(booked()).toEqual([sessionId]);
  });

  it("reads the standing again when it was not cached yet", async () => {
    api.bookSession.mockResolvedValue(booking("registered"));
    const { queryClient, wrapper } = setup({ mine: null });
    const invalidate = jest.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useBookSession(eventId, sessionId), {
      wrapper,
    });

    await act(() => result.current.mutateAsync());

    expect(invalidate).toHaveBeenCalledWith({ queryKey: mineKey });
  });

  it.each(["SESSION_FULL", "EVENT_REGISTRATION_REQUIRED", "ALREADY_BOOKED"])(
    "re-reads the standing and the seats on a 409 %s, without moving the count",
    async (code) => {
      api.bookSession.mockRejectedValue(new ApiError(409, code, code));
      const { wrapper, isStale, seatsOf } = setup();
      const { result } = renderHook(() => useBookSession(eventId, sessionId), {
        wrapper,
      });

      await act(() => result.current.mutateAsync().catch(() => undefined));

      expect(isStale(mineKey)).toBe(true);
      expect(isStale(sessionPageKey)).toBe(true);
      expect(seatsOf(sessionPageKey)).toBe(32);
    },
  );

  it("reloads nothing on a rate limit", async () => {
    api.bookSession.mockRejectedValue(
      new ApiError(429, "RATE_LIMITED", "slow"),
    );
    const { wrapper, isStale } = setup();
    const { result } = renderHook(() => useBookSession(eventId, sessionId), {
      wrapper,
    });

    await act(() => result.current.mutateAsync().catch(() => undefined));

    expect(isStale(mineKey)).toBe(false);
    expect(isStale(sessionPageKey)).toBe(false);
  });
});

describe("useCancelSessionBooking", () => {
  it("releases the seat: unmarks the session and gives one seat back, with no refetch", async () => {
    api.cancelSessionBooking.mockResolvedValue(booking("cancelled"));
    const { wrapper, isStale, seatsOf, booked } = setup({
      mine: standing([otherSessionId, sessionId]),
    });
    const { result } = renderHook(
      () => useCancelSessionBooking(eventId, sessionId),
      { wrapper },
    );

    await act(() => result.current.mutateAsync());

    expect(api.cancelSessionBooking).toHaveBeenCalledWith(eventId, sessionId);
    // Only this seat: the other session stays booked.
    expect(booked()).toEqual([otherSessionId]);
    expect(seatsOf(sessionPageKey)).toBe(33);
    expect(isStale(mineKey)).toBe(false);
  });

  it.each([
    new ApiError(409, "ALREADY_CHECKED_IN", "checked in"),
    new ApiError(409, "CANCELLATION_CLOSED", "closed"),
    new ApiError(404, "NOT_FOUND", "No booking"),
  ])("re-reads the standing when the server refuses: $code", async (error) => {
    api.cancelSessionBooking.mockRejectedValue(error);
    const { wrapper, isStale, seatsOf } = setup({
      mine: standing([sessionId]),
    });
    const { result } = renderHook(
      () => useCancelSessionBooking(eventId, sessionId),
      { wrapper },
    );

    await act(() => result.current.mutateAsync().catch(() => undefined));

    expect(isStale(mineKey)).toBe(true);
    expect(seatsOf(sessionPageKey)).toBe(32);
  });
});
