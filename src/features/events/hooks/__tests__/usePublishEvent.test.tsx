/** @jest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApiError } from "../../../../core/api-client/base-api.service";
import { eventApiService } from "../../api/event-api.service";
import type { EventDto } from "../../schemas/events.schemas";
import { eventQueryKeys } from "../event-cache";
import { usePublishEvent } from "../usePublishEvent";

jest.mock("../../api/event-api.service", () => ({
  eventApiService: { publish: jest.fn() },
}));
const api = jest.mocked(eventApiService);

const eventId = "8c1f4f6e-2f4b-4c43-9a59-0d6f2a1b7e10";
const body = {
  registrationOpensAt: "2026-11-03T09:30:00+05:30",
  registrationClosesAt: "2026-12-10T17:30:00+05:30",
};
const published = { id: eventId, status: "published" } as EventDto;

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(eventQueryKeys.overview(eventId), {});
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const isStale = (key: readonly unknown[]) =>
    queryClient.getQueryState(key)?.isInvalidated === true;
  return { wrapper, isStale };
}

beforeEach(() => jest.resetAllMocks());

describe("usePublishEvent", () => {
  it("publishes the event with the dates registration opens and closes", async () => {
    api.publish.mockResolvedValue(published);
    const { wrapper } = setup();
    const { result } = renderHook(() => usePublishEvent(), { wrapper });

    await act(() => result.current.mutateAsync({ eventId, body }));

    expect(api.publish).toHaveBeenCalledWith(eventId, body);
  });

  it("reloads the event's pages once it is published", async () => {
    api.publish.mockResolvedValue(published);
    const { wrapper, isStale } = setup();
    const { result } = renderHook(() => usePublishEvent(), { wrapper });

    await act(() => result.current.mutateAsync({ eventId, body }));

    expect(isStale(eventQueryKeys.overview(eventId))).toBe(true);
  });

  it("keeps the server's refusal, and reloads nothing", async () => {
    api.publish.mockRejectedValue(
      new ApiError(400, "VALIDATION_ERROR", "Invalid request", {
        registrationClosesAt: ["Registration must end in the future"],
      }),
    );
    const { wrapper, isStale } = setup();
    const { result } = renderHook(() => usePublishEvent(), { wrapper });

    await act(() =>
      result.current.mutateAsync({ eventId, body }).catch(() => undefined),
    );

    await waitFor(() =>
      expect(result.current.error?.fieldErrors.registrationClosesAt).toEqual([
        "Registration must end in the future",
      ]),
    );
    expect(isStale(eventQueryKeys.overview(eventId))).toBe(false);
  });
});
