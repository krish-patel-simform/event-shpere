/** @jest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApiError } from "../../../../core/api-client/base-api.service";
import { registrationApiService } from "../../api/registration-api.service";
import { registrationQueryKeys } from "../registration-cache";
import { useBookSession } from "../useBookSession";
import { useCancelRegistration } from "../useCancelRegistration";
import { useCancelSessionBooking } from "../useCancelSessionBooking";
import { useGetMyTickets } from "../useGetMyTickets";
import { useRegisterForEvent } from "../useRegisterForEvent";

jest.mock("../../api/registration-api.service", () => ({
  registrationApiService: {
    listMyTickets: jest.fn(),
    register: jest.fn(),
    cancel: jest.fn(),
    bookSession: jest.fn(),
    cancelSessionBooking: jest.fn(),
  },
}));
const api = jest.mocked(registrationApiService);

const eventId = "6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d";
const sessionId = "3f2b8a10-6c4d-4e57-8b19-0a1d2c3e4f01";
const upcoming = {
  when: "upcoming",
  status: "all",
  page: 1,
  pageSize: 10,
} as const;
const past = { ...upcoming, when: "past" } as const;
const EMPTY_PAGE = { items: [], meta: { page: 1, pageSize: 10, total: 0 } };

/** A client that holds two pages of "My tickets" (upcoming and past). */
function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(
    registrationQueryKeys.ticketList(upcoming),
    EMPTY_PAGE,
  );
  queryClient.setQueryData(registrationQueryKeys.ticketList(past), EMPTY_PAGE);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const ticketsStale = () =>
    [upcoming, past].every(
      (params) =>
        queryClient.getQueryState(registrationQueryKeys.ticketList(params))
          ?.isInvalidated === true,
    );
  return { wrapper, ticketsStale };
}

beforeEach(() => jest.resetAllMocks());

describe("useGetMyTickets", () => {
  it("asks for the page and filters it was given", async () => {
    api.listMyTickets.mockResolvedValue(EMPTY_PAGE);
    const { wrapper } = setup();
    const params = {
      when: "all",
      status: "cancelled",
      page: 2,
      pageSize: 10,
    } as const;

    const { result } = renderHook(() => useGetMyTickets(params), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.listMyTickets).toHaveBeenCalledWith(params);
  });

  it("is a new query for another filter: no rows of the previous one meanwhile", () => {
    api.listMyTickets.mockReturnValue(new Promise(() => {}));
    const { wrapper } = setup();

    const { result } = renderHook(
      () => useGetMyTickets({ ...upcoming, status: "registered" }),
      { wrapper },
    );

    expect(result.current.isPending).toBe(true);
    expect(result.current.data).toBeUndefined();
  });
});

describe("every change to a registration or a seat refreshes 'My tickets'", () => {
  const ticket = {
    id: "1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e",
    eventId,
    status: "registered" as const,
    ticketCode: "ESEVT7K3Q9P",
    amount: 0,
    currency: "INR",
    reason: "free" as const,
    registeredAt: "2026-11-10T10:00:00.000Z",
  };
  const seat = {
    id: "7d8e9f0a-1b2c-4d3e-8f4a-5b6c7d8e9f0a",
    sessionId,
    status: "registered" as const,
    registeredAt: "2026-11-12T10:00:00.000Z",
  };

  // Each row: a name, how the API answers, and the hook whose action is run. The four hooks
  // answer different types, so the table says only what the test uses: an action to await.
  type Row = [
    string,
    () => void,
    () => { mutateAsync: () => Promise<unknown> },
  ];
  it.each<Row>([
    [
      "registering",
      () => api.register.mockResolvedValue(ticket),
      () => useRegisterForEvent(eventId),
    ],
    [
      "cancelling a registration",
      () =>
        api.cancel.mockResolvedValue({
          registration: { ...ticket, status: "cancelled" },
          bookedSessionIds: [],
        }),
      () => useCancelRegistration(eventId),
    ],
    [
      "booking a seat (the seat count changes)",
      () => api.bookSession.mockResolvedValue(seat),
      () => useBookSession(eventId, sessionId),
    ],
    [
      "cancelling a seat",
      () =>
        api.cancelSessionBooking.mockResolvedValue({
          ...seat,
          status: "cancelled",
        }),
      () => useCancelSessionBooking(eventId, sessionId),
    ],
  ])("after %s, every tab and page", async (_name, answer, useAction) => {
    answer();
    const { wrapper, ticketsStale } = setup();
    const { result } = renderHook(useAction, { wrapper });

    await act(() => result.current.mutateAsync());

    expect(ticketsStale()).toBe(true);
  });

  it("also after a refused cancel (409), as the ticket's state changed", async () => {
    api.cancel.mockRejectedValue(
      new ApiError(409, "ALREADY_CHECKED_IN", "checked in"),
    );
    const { wrapper, ticketsStale } = setup();
    const { result } = renderHook(() => useCancelRegistration(eventId), {
      wrapper,
    });

    await act(() => result.current.mutateAsync().catch(() => undefined));

    expect(ticketsStale()).toBe(true);
  });

  it("not after a rate limit: nothing changed", async () => {
    api.cancel.mockRejectedValue(new ApiError(429, "RATE_LIMITED", "slow"));
    const { wrapper, ticketsStale } = setup();
    const { result } = renderHook(() => useCancelRegistration(eventId), {
      wrapper,
    });

    await act(() => result.current.mutateAsync().catch(() => undefined));

    expect(ticketsStale()).toBe(false);
  });
});
