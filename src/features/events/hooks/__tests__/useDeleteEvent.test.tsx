/** @jest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApiError } from "../../../../core/api-client/base-api.service";
import { eventApiService } from "../../api/event-api.service";
import { eventQueryKeys } from "../event-cache";
import { useDeleteEvent } from "../useDeleteEvent";

jest.mock("../../api/event-api.service", () => ({
  eventApiService: { remove: jest.fn() },
}));
const api = jest.mocked(eventApiService);

const eventId = "8c1f4f6e-2f4b-4c43-9a59-0d6f2a1b7e10";
const listKey = eventQueryKeys.list({
  status: "all",
  search: "",
  sort: "soonest",
  page: 1,
  pageSize: 10,
});
const sessionKey = ["sessions", "list", eventId] as const;

/** A client that already holds what the organizer's screens would have loaded. */
function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  for (const key of [
    listKey,
    eventQueryKeys.counts,
    eventQueryKeys.overview(eventId),
    eventQueryKeys.content(eventId),
    sessionKey,
  ]) {
    queryClient.setQueryData(key, []);
  }
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const isStale = (key: readonly unknown[]) =>
    queryClient.getQueryState(key)?.isInvalidated === true;
  return { queryClient, wrapper, isStale };
}

beforeEach(() => jest.resetAllMocks());

describe("useDeleteEvent", () => {
  it("deletes the event by its id", async () => {
    api.remove.mockResolvedValue(undefined);
    const { wrapper } = setup();
    const { result } = renderHook(() => useDeleteEvent(), { wrapper });

    await act(() => result.current.mutateAsync(eventId));

    expect(api.remove).toHaveBeenCalledWith(eventId);
  });

  it("reads the lists and the tab counts again, as the row is gone", async () => {
    api.remove.mockResolvedValue(undefined);
    const { wrapper, isStale } = setup();
    const { result } = renderHook(() => useDeleteEvent(), { wrapper });

    await act(() => result.current.mutateAsync(eventId));

    expect(isStale(listKey)).toBe(true);
    expect(isStale(eventQueryKeys.counts)).toBe(true);
  });

  it("marks the deleted event's own pages old, but does not ask the server for them (it would only get a 404)", async () => {
    api.remove.mockResolvedValue(undefined);
    const { queryClient, wrapper, isStale } = setup();
    const refetch = jest.spyOn(queryClient, "refetchQueries");
    const { result } = renderHook(() => useDeleteEvent(), { wrapper });

    await act(() => result.current.mutateAsync(eventId));

    expect(isStale(eventQueryKeys.overview(eventId))).toBe(true);
    expect(isStale(eventQueryKeys.content(eventId))).toBe(true);
    expect(isStale(sessionKey)).toBe(true);
    // Only the lists and the counts are asked for again, never the deleted event's own pages.
    const refetched = refetch.mock.calls.map(
      ([filters]) => (filters?.queryKey as readonly unknown[])[1],
    );
    expect(refetched).toEqual(["list", "counts"]);
  });

  it("reloads nothing when the delete fails", async () => {
    api.remove.mockRejectedValue(
      new ApiError(409, "EVENT_NOT_DRAFT", "Only a draft can be deleted"),
    );
    const { wrapper, isStale } = setup();
    const { result } = renderHook(() => useDeleteEvent(), { wrapper });

    await act(() => result.current.mutateAsync(eventId).catch(() => undefined));

    expect(isStale(listKey)).toBe(false);
    expect(isStale(eventQueryKeys.overview(eventId))).toBe(false);
  });
});
