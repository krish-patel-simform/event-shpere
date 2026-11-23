/** @jest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { registrationApiService } from "../../api/registration-api.service";
import { registrationQueryKeys } from "../registration-cache";
import { useGetEventAttendees } from "../useGetEventAttendees";

jest.mock("../../api/registration-api.service", () => ({
  registrationApiService: { listEventAttendees: jest.fn() },
}));
const api = jest.mocked(registrationApiService);

const eventId = "6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d";
const params = {
  page: 1,
  pageSize: 10,
  status: "all",
  checkedIn: "all",
  sort: "newest",
  search: "",
} as const;
const EMPTY = {
  items: [],
  meta: {
    page: 1,
    pageSize: 10,
    total: 0,
    counts: { registered: 0, cancelled: 0, checkedIn: 0, pending: 0 },
    checkInOpensHoursBefore: 6,
  },
};

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

beforeEach(() => jest.resetAllMocks());

describe("useGetEventAttendees", () => {
  it("asks for the event's attendees with the filters it was given", async () => {
    api.listEventAttendees.mockResolvedValue(EMPTY);
    const { wrapper } = setup();

    const { result } = renderHook(
      () => useGetEventAttendees(eventId, { ...params, date: "2026-12-04" }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.listEventAttendees).toHaveBeenCalledWith(eventId, {
      ...params,
      date: "2026-12-04",
    });
  });

  it("keeps each event's lists under the event, so one key refreshes all its pages", async () => {
    api.listEventAttendees.mockResolvedValue(EMPTY);
    const { queryClient, wrapper } = setup();

    const { result } = renderHook(() => useGetEventAttendees(eventId, params), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    await queryClient.invalidateQueries({
      queryKey: registrationQueryKeys.attendees(eventId),
    });
    expect(api.listEventAttendees).toHaveBeenCalledTimes(2);
  });
});

describe("session attendee keys", () => {
  it("sit under their event's attendees key, so one refresh after a check-in covers the event and its sessions", () => {
    const sessionId = "3f2b8a10-6c4d-4e57-8b19-0a1d2c3e4f01";
    const root = registrationQueryKeys.attendees(eventId);

    for (const key of [
      registrationQueryKeys.sessionAttendeeList(eventId, sessionId, params),
      registrationQueryKeys.sessionAttendeeCounts(eventId, sessionId),
      registrationQueryKeys.attendeeCounts(eventId, undefined),
    ]) {
      expect(key.slice(0, root.length)).toEqual([...root]);
    }
  });

  it("keep two sessions' lists apart", () => {
    expect(
      registrationQueryKeys.sessionAttendeeCounts(eventId, "a"),
    ).not.toEqual(registrationQueryKeys.sessionAttendeeCounts(eventId, "b"));
  });
});
