/** @jest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApiError } from "../../../../core/api-client/base-api.service";
import { eventApiService } from "../../api/event-api.service";
import type { EventDto } from "../../schemas/events.schemas";
import { eventQueryKeys, SESSIONS_QUERY_ROOT } from "../event-cache";
import { useCancelEvent } from "../useCancelEvent";

jest.mock("../../api/event-api.service", () => ({
  eventApiService: { cancel: jest.fn() },
}));
const api = jest.mocked(eventApiService);

const eventId = "8c1f4f6e-2f4b-4c43-9a59-0d6f2a1b7e10";
const sessionsListKey = ["sessions", "list", eventId] as const;
const otherEventListKey = ["sessions", "list", "another-event"] as const;
const sessionKey = ["sessions", "detail", eventId, "s-1"] as const;
const cancelled = { id: eventId, status: "cancelled" } as EventDto;

/** A client that already holds what the organizer's screens would have loaded. */
function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  for (const key of [
    eventQueryKeys.overview(eventId),
    sessionsListKey,
    otherEventListKey,
    sessionKey,
  ]) {
    queryClient.setQueryData(key, []);
  }
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const isStale = (key: readonly unknown[]) =>
    queryClient.getQueryState(key)?.isInvalidated === true;
  return { wrapper, isStale };
}

beforeEach(() => jest.resetAllMocks());

describe("useCancelEvent", () => {
  it("cancels the event by its id", async () => {
    api.cancel.mockResolvedValue(cancelled);
    const { wrapper } = setup();
    const { result } = renderHook(() => useCancelEvent(), { wrapper });

    await act(() => result.current.mutateAsync(eventId));

    expect(api.cancel).toHaveBeenCalledWith(eventId);
  });

  it("reloads the event's pages and every sessions list and detail, as the server cancelled all its sessions", async () => {
    api.cancel.mockResolvedValue(cancelled);
    const { wrapper, isStale } = setup();
    const { result } = renderHook(() => useCancelEvent(), { wrapper });

    await act(() => result.current.mutateAsync(eventId));

    expect(isStale(eventQueryKeys.overview(eventId))).toBe(true);
    expect(isStale(sessionsListKey)).toBe(true);
    expect(isStale(sessionKey)).toBe(true);
    // Any sessions list is reloaded, not only this event's: it is cheap and never wrong.
    expect(isStale(otherEventListKey)).toBe(true);
  });

  it("reloads nothing when the cancel fails", async () => {
    api.cancel.mockRejectedValue(
      new ApiError(409, "EVENT_NOT_PUBLISHED", "A draft is deleted"),
    );
    const { wrapper, isStale } = setup();
    const { result } = renderHook(() => useCancelEvent(), { wrapper });

    await act(() => result.current.mutateAsync(eventId).catch(() => undefined));

    expect(isStale(sessionsListKey)).toBe(false);
    expect(isStale(eventQueryKeys.overview(eventId))).toBe(false);
  });

  it("uses the same root key as the sessions feature", () => {
    expect(SESSIONS_QUERY_ROOT).toEqual(["sessions"]);
  });
});
