/** @jest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApiError } from "../../../../core/api-client/base-api.service";
import { registrationApiService } from "../../api/registration-api.service";
import type {
  MyRegistrationDto,
  RegistrationDto,
} from "../../schemas/registrations.schemas";
import {
  PUBLIC_EVENT_DETAILS_KEY,
  registrationQueryKeys,
} from "../registration-cache";
import { useCancelRegistration } from "../useCancelRegistration";
import { useGetMyRegistration } from "../useGetMyRegistration";
import { useRegisterForEvent } from "../useRegisterForEvent";

jest.mock("../../api/registration-api.service", () => ({
  registrationApiService: {
    register: jest.fn(),
    getMine: jest.fn(),
    cancel: jest.fn(),
  },
}));
const api = jest.mocked(registrationApiService);

const eventId = "6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d";
const otherEventId = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const SESSION_ID = "3f2b8a10-6c4d-4e57-8b19-0a1d2c3e4f01";
const publicPageKey = [...PUBLIC_EVENT_DETAILS_KEY, "summit"] as const;
const otherPublicPageKey = [...PUBLIC_EVENT_DETAILS_KEY, "other"] as const;
const unlimitedPageKey = [...PUBLIC_EVENT_DETAILS_KEY, "open-meetup"] as const;

const ticket: RegistrationDto = {
  id: "1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e",
  eventId,
  status: "registered",
  ticketCode: "ESEVT7K3Q9P",
  amount: 0,
  currency: "INR",
  reason: "free",
  registeredAt: "2026-11-10T10:00:00.000Z",
};

/** The part of a cached public event page these hooks touch (the real one has much more). */
const seatsOf = (queryClient: QueryClient, key: readonly unknown[]): unknown =>
  (queryClient.getQueryData(key) as { seatsLeft: number | null }).seatsLeft;

/**
 * A client that already holds the public pages of this event (120 seats left) and another one,
 * and the user's standing in both events.
 */
function setup({ seatsLeft = 120 }: { seatsLeft?: number | null } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(publicPageKey, {
    id: eventId,
    title: "Summit",
    seatsLeft,
  });
  queryClient.setQueryData(otherPublicPageKey, {
    id: otherEventId,
    title: "Other",
    seatsLeft: 50,
  });
  queryClient.setQueryData(registrationQueryKeys.mine(eventId), {
    registration: null,
    bookedSessionIds: [],
  });
  queryClient.setQueryData(registrationQueryKeys.mine(otherEventId), {
    registration: null,
    bookedSessionIds: [],
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const isStale = (key: readonly unknown[]) =>
    queryClient.getQueryState(key)?.isInvalidated === true;
  return { queryClient, wrapper, isStale };
}

beforeEach(() => jest.resetAllMocks());

describe("useGetMyRegistration", () => {
  it("reads the standing of the signed-in user in this event", async () => {
    const standing: MyRegistrationDto = {
      registration: ticket,
      bookedSessionIds: [SESSION_ID],
    };
    api.getMine.mockResolvedValue(standing);
    const { wrapper } = setup();
    const { result } = renderHook(
      () => useGetMyRegistration("2d3e4f50-6a7b-4c8d-9e0f-1a2b3c4d5e6f"),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(standing);
  });

  it("does not ask at all when disabled (a guest, or an organizer/admin)", () => {
    const { wrapper } = setup();
    renderHook(
      () =>
        useGetMyRegistration("2d3e4f50-6a7b-4c8d-9e0f-1a2b3c4d5e6f", {
          enabled: false,
        }),
      { wrapper },
    );

    expect(api.getMine).not.toHaveBeenCalled();
  });
});

describe("useRegisterForEvent", () => {
  it("shows the new ticket at once (no seats yet) and one seat fewer, without any refetch", async () => {
    api.register.mockResolvedValue(ticket);
    const { queryClient, wrapper, isStale } = setup();
    const { result } = renderHook(() => useRegisterForEvent(eventId), {
      wrapper,
    });

    await act(() => result.current.mutateAsync());

    expect(api.register).toHaveBeenCalledWith(eventId);
    expect(
      queryClient.getQueryData(registrationQueryKeys.mine(eventId)),
    ).toEqual({ registration: ticket, bookedSessionIds: [] });
    expect(seatsOf(queryClient, publicPageKey)).toBe(119);
    // The rest of the page is kept as it was.
    expect(queryClient.getQueryData(publicPageKey)).toMatchObject({
      id: eventId,
      title: "Summit",
    });
    // No refetch: the CDN could answer it with a copy from before the registration.
    expect(isStale(publicPageKey)).toBe(false);
    // The standing was just set from the answer: no second request for it.
    expect(isStale(registrationQueryKeys.mine(eventId))).toBe(false);
    // Another event's page and standing are untouched.
    expect(seatsOf(queryClient, otherPublicPageKey)).toBe(50);
    expect(isStale(registrationQueryKeys.mine(otherEventId))).toBe(false);
  });

  it("keeps 'no seat limit' as no limit", async () => {
    api.register.mockResolvedValue(ticket);
    const { queryClient, wrapper } = setup({ seatsLeft: null });
    const { result } = renderHook(() => useRegisterForEvent(eventId), {
      wrapper,
    });

    await act(() => result.current.mutateAsync());

    expect(seatsOf(queryClient, publicPageKey)).toBeNull();
  });

  it("never shows fewer than 0 seats (the page already said 0)", async () => {
    api.register.mockResolvedValue(ticket);
    const { queryClient, wrapper } = setup({ seatsLeft: 0 });
    const { result } = renderHook(() => useRegisterForEvent(eventId), {
      wrapper,
    });

    await act(() => result.current.mutateAsync());

    expect(seatsOf(queryClient, publicPageKey)).toBe(0);
  });

  it("leaves cached data of another shape alone", async () => {
    api.register.mockResolvedValue(ticket);
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(unlimitedPageKey, "not a page");
    const { result } = renderHook(() => useRegisterForEvent(eventId), {
      wrapper,
    });

    await act(() => result.current.mutateAsync());

    expect(queryClient.getQueryData(unlimitedPageKey)).toBe("not a page");
  });

  it("re-reads the standing and the seats on a 409 (the page was out of date), and does not move the count", async () => {
    api.register.mockRejectedValue(
      new ApiError(409, "EVENT_FULL", "This event is full"),
    );
    const { queryClient, wrapper, isStale } = setup();
    const { result } = renderHook(() => useRegisterForEvent(eventId), {
      wrapper,
    });

    await act(() => result.current.mutateAsync().catch(() => undefined));

    expect(isStale(registrationQueryKeys.mine(eventId))).toBe(true);
    expect(isStale(publicPageKey)).toBe(true);
    expect(seatsOf(queryClient, publicPageKey)).toBe(120);
    // The hook's error state reaches `result` on the next render, not with the rejected promise.
    await waitFor(() => expect(result.current.error?.code).toBe("EVENT_FULL"));
  });

  it("reloads nothing on a busy server or a lost connection", async () => {
    api.register.mockRejectedValue(new ApiError(0, "NETWORK_ERROR", "offline"));
    const { wrapper, isStale } = setup();
    const { result } = renderHook(() => useRegisterForEvent(eventId), {
      wrapper,
    });

    await act(() => result.current.mutateAsync().catch(() => undefined));

    expect(isStale(registrationQueryKeys.mine(eventId))).toBe(false);
    expect(isStale(publicPageKey)).toBe(false);
  });
});

describe("useCancelRegistration", () => {
  const cancelled: MyRegistrationDto = {
    registration: { ...ticket, status: "cancelled" },
    bookedSessionIds: [],
  };

  it("stores the cancelled standing and shows one seat more, without any refetch", async () => {
    api.cancel.mockResolvedValue(cancelled);
    const { queryClient, wrapper, isStale } = setup();
    const { result } = renderHook(() => useCancelRegistration(eventId), {
      wrapper,
    });

    await act(() => result.current.mutateAsync());

    expect(api.cancel).toHaveBeenCalledWith(eventId);
    expect(
      queryClient.getQueryData(registrationQueryKeys.mine(eventId)),
    ).toEqual(cancelled);
    expect(seatsOf(queryClient, publicPageKey)).toBe(121);
    expect(isStale(publicPageKey)).toBe(false);
    expect(seatsOf(queryClient, otherPublicPageKey)).toBe(50);
  });

  it("does not move the count when the cancel is refused", async () => {
    api.cancel.mockRejectedValue(
      new ApiError(409, "ALREADY_CHECKED_IN", "checked in"),
    );
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useCancelRegistration(eventId), {
      wrapper,
    });

    await act(() => result.current.mutateAsync().catch(() => undefined));

    expect(seatsOf(queryClient, publicPageKey)).toBe(120);
  });

  it.each([
    new ApiError(409, "ALREADY_CHECKED_IN", "checked in"),
    new ApiError(409, "CANCELLATION_CLOSED", "closed"),
    new ApiError(404, "NOT_FOUND", "No registration"),
  ])("re-reads the standing when the server refuses: $code", async (error) => {
    api.cancel.mockRejectedValue(error);
    const { wrapper, isStale } = setup();
    const { result } = renderHook(() => useCancelRegistration(eventId), {
      wrapper,
    });

    await act(() => result.current.mutateAsync().catch(() => undefined));

    expect(isStale(registrationQueryKeys.mine(eventId))).toBe(true);
  });

  it("reloads nothing when rate limited", async () => {
    api.cancel.mockRejectedValue(new ApiError(429, "RATE_LIMITED", "slow"));
    const { wrapper, isStale } = setup();
    const { result } = renderHook(() => useCancelRegistration(eventId), {
      wrapper,
    });

    await act(() => result.current.mutateAsync().catch(() => undefined));

    expect(isStale(registrationQueryKeys.mine(eventId))).toBe(false);
  });
});
