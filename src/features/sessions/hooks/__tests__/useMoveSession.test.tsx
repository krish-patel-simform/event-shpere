/** @jest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApiError } from "../../../../core/api-client/base-api.service";
import { sessionApiService } from "../../api/session-api.service";
import {
  EVENT_ID,
  HALL_B_ID,
  talk,
  workshop,
} from "../../__fixtures__/organizer-sessions";
import { sessionQueryKeys } from "../session-cache";
import { useMoveSession } from "../useMoveSession";

jest.mock("../../api/session-api.service", () => ({
  sessionApiService: { update: jest.fn() },
}));
// The events feature's barrel pulls in components and the shared client: only its cache is needed.
jest.mock("../../../events", () =>
  jest.requireActual("../../../events/hooks/event-cache"),
);

const api = jest.mocked(sessionApiService);
const listKey = sessionQueryKeys.list(EVENT_ID);

const move = {
  hallId: HALL_B_ID,
  startAt: "2026-12-13T08:30:00.000Z",
  endAt: "2026-12-13T09:30:00.000Z",
};
const variables = { sessionId: talk.id, move, hallName: "Hall B" };

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(listKey, [talk, workshop]);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(() => useMoveSession(EVENT_ID), { wrapper }) };
}

beforeEach(() => jest.resetAllMocks());

describe("useMoveSession", () => {
  it("sends the move to the API for that session", async () => {
    api.update.mockResolvedValue({ ...talk, ...move });
    const { result } = setup();

    await act(() => result.current.mutateAsync(variables));

    expect(api.update).toHaveBeenCalledWith(EVENT_ID, talk.id, move);
  });

  it("shows the move in the session list before the server answers", async () => {
    // The server answers later: the list must already show the move.
    api.update.mockReturnValue(new Promise(() => {}));
    const { client, result } = setup();

    act(() => result.current.mutate(variables));

    await waitFor(() =>
      expect(client.getQueryData<(typeof talk)[]>(listKey)?.[0]).toMatchObject({
        ...move,
        hallName: "Hall B",
      }),
    );
    // The other session is not touched.
    expect(client.getQueryData<(typeof talk)[]>(listKey)?.[1]).toBe(workshop);
  });

  it("puts the list back and keeps the server's reason when the move is refused", async () => {
    api.update.mockRejectedValue(
      new ApiError(409, "HALL_BUSY", "This hall is busy at that time"),
    );
    const { client, result } = setup();

    await act(async () => {
      await result.current.mutateAsync(variables).catch(() => undefined);
    });

    expect(client.getQueryData(listKey)).toEqual([talk, workshop]);
    await waitFor(() =>
      expect(result.current.error).toMatchObject({
        status: 409,
        message: "This hall is busy at that time",
      }),
    );
  });

  it("reads the event's lists again afterwards, whether it worked or not", async () => {
    api.update.mockRejectedValue(new ApiError(409, "HALL_BUSY", "Busy"));
    const { client, result } = setup();
    const invalidate = jest.spyOn(client, "invalidateQueries");

    await act(async () => {
      await result.current.mutateAsync(variables).catch(() => undefined);
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: listKey });
  });
});

describe("useMoveSession: two moves at the same time", () => {
  const otherMove = {
    hallId: HALL_B_ID,
    startAt: "2026-12-13T10:30:00.000Z",
    endAt: "2026-12-13T11:30:00.000Z",
  };
  const otherVariables = {
    sessionId: workshop.id,
    move: otherMove,
    hallName: "Hall B",
  };

  /** The request of each session stays open until the test answers it. */
  function gatedApi() {
    const gates = new Map<
      string,
      { resolve: () => void; reject: (error: Error) => void }
    >();
    api.update.mockImplementation(
      (_eventId, sessionId, body) =>
        new Promise((resolve, reject) => {
          gates.set(sessionId, {
            resolve: () =>
              resolve({
                ...(sessionId === talk.id ? talk : workshop),
                ...body,
              } as never),
            reject,
          });
        }),
    );
    return gates;
  }

  const listNow = (client: QueryClient) =>
    client.getQueryData<(typeof talk)[]>(listKey) ?? [];

  async function startBoth(result: ReturnType<typeof setup>["result"]) {
    let first: Promise<unknown> = Promise.resolve();
    let second: Promise<unknown> = Promise.resolve();
    act(() => {
      first = result.current.mutateAsync(variables).catch(() => undefined);
      second = result.current
        .mutateAsync(otherVariables)
        .catch(() => undefined);
    });
    return { first: () => first, second: () => second };
  }

  it("shows both moves at once", async () => {
    gatedApi();
    const { client, result } = setup();

    await startBoth(result);

    await waitFor(() => {
      expect(listNow(client)[0]).toMatchObject({ ...move, hallName: "Hall B" });
      expect(listNow(client)[1]).toMatchObject(otherMove);
    });
  });

  it("puts back only the refused session, and keeps the other move that is still being saved", async () => {
    const gates = gatedApi();
    const { client, result } = setup();
    const done = await startBoth(result);
    await waitFor(() => expect(gates.size).toBe(2));

    await act(async () => {
      gates.get(talk.id)?.reject(new ApiError(409, "HALL_BUSY", "Busy"));
      await done.first();
    });

    // The talk is back where it was; the workshop is still shown at its new place.
    expect(listNow(client)[0]).toEqual(talk);
    expect(listNow(client)[1]).toMatchObject(otherMove);
  });

  it("leaves a move that worked in place when the other one is refused", async () => {
    const gates = gatedApi();
    const { client, result } = setup();
    const done = await startBoth(result);
    await waitFor(() => expect(gates.size).toBe(2));

    await act(async () => {
      gates.get(talk.id)?.resolve();
      await done.first();
    });
    await act(async () => {
      gates.get(workshop.id)?.reject(new ApiError(409, "HALL_BUSY", "Busy"));
      await done.second();
    });

    expect(listNow(client)[0]).toMatchObject(move);
    expect(listNow(client)[1]).toEqual(workshop);
  });

  it("reads the list again only when the last move has finished, not between them", async () => {
    const gates = gatedApi();
    const { client, result } = setup();
    const invalidate = jest.spyOn(client, "invalidateQueries");
    const done = await startBoth(result);
    await waitFor(() => expect(gates.size).toBe(2));

    await act(async () => {
      gates.get(talk.id)?.resolve();
      await done.first();
    });
    // One is still being saved: reading the list now would bring back its old place.
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: listKey });

    await act(async () => {
      gates.get(workshop.id)?.resolve();
      await done.second();
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: listKey });
  });
});
