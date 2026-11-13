/** @jest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApiError } from "../../../../core/api-client/base-api.service";
import { eventQueryKeys, SESSIONS_QUERY_ROOT } from "../../../events";
import { sessionApiService } from "../../api/session-api.service";
import type { SessionContentDto } from "../../schemas/session-content.schemas";
import type {
  CreateSessionRequest,
  SessionDto,
} from "../../schemas/sessions.schemas";
import { sessionMutationKeys, sessionQueryKeys } from "../session-cache";
import { useCancelSession } from "../useCancelSession";
import { useCreateSession } from "../useCreateSession";
import { useDeleteSessionCover } from "../useDeleteSessionCover";
import { useGetEventSessions } from "../useGetEventSessions";
import { useGetSession } from "../useGetSession";
import { useGetSessionContent } from "../useGetSessionContent";
import { useReplaceSessionSpeakers } from "../useReplaceSessionSpeakers";
import { useUpdateSession } from "../useUpdateSession";
import { useUpdateSessionContent } from "../useUpdateSessionContent";
import { useUploadSessionCover } from "../useUploadSessionCover";

jest.mock("../../api/session-api.service", () => ({
  sessionApiService: {
    listForEvent: jest.fn(),
    get: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    replaceSpeakers: jest.fn(),
    cancel: jest.fn(),
    getContent: jest.fn(),
    updateContent: jest.fn(),
    uploadCover: jest.fn(),
    deleteCover: jest.fn(),
  },
}));
// The events feature's barrel pulls in components and the shared client: only its cache is needed.
jest.mock("../../../events", () =>
  jest.requireActual("../../../events/hooks/event-cache"),
);

const api = jest.mocked(sessionApiService);

const eventId = "4e5f6a7b-8c9d-4e0f-a1b2-c3d4e5f6a7b8";
const otherEventId = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const sessionId = "6c7d8e9f-0a1b-4c2d-9e3f-4a5b6c7d8e9f";
const otherSessionId = "1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e";

const session: SessionDto = {
  id: sessionId,
  eventId,
  hallId: "3f2b8a10-6c4d-4e57-8b19-0a1d2c3e4f01",
  hallName: "Main Hall",
  title: "Offline-first Event Apps",
  type: "talk",
  mode: "in_person",
  status: "scheduled",
  onlineUrl: null,
  startAt: "2026-12-12T04:30:00.000Z",
  endAt: "2026-12-12T05:30:00.000Z",
  requiresRegistration: false,
  price: 0,
  speakers: [
    {
      speakerId: "4a5b6c7d-8e9f-4a0b-9c1d-2e3f4a5b6c7d",
      name: "Anna Rao",
      role: "speaker",
      displayOrder: 0,
    },
  ],
};

const content: SessionContentDto = {
  description: "About the session",
  prerequisites: null,
  resources: [],
  coverImage: null,
};

/** A client that already holds what the organizer's screens would have loaded. */
function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(sessionQueryKeys.list(eventId), [session]);
  queryClient.setQueryData(sessionQueryKeys.list(otherEventId), []);
  queryClient.setQueryData(
    sessionQueryKeys.detail(eventId, sessionId),
    session,
  );
  queryClient.setQueryData(
    sessionQueryKeys.detail(eventId, otherSessionId),
    session,
  );
  queryClient.setQueryData(
    sessionQueryKeys.content(eventId, sessionId),
    content,
  );
  queryClient.setQueryData(eventQueryKeys.overview(eventId), {});
  queryClient.setQueryData(eventQueryKeys.overview(otherEventId), {});
  queryClient.setQueryData(eventQueryKeys.lists, []);
  queryClient.setQueryData(eventQueryKeys.counts, {});
  queryClient.setQueryData(eventQueryKeys.publicDetail("pune-tech"), {});

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const isStale = (key: readonly unknown[]) =>
    queryClient.getQueryState(key)?.isInvalidated === true;
  return { queryClient, wrapper, isStale };
}

beforeEach(() => jest.resetAllMocks());

const newSession: CreateSessionRequest = {
  title: "Offline-first Event Apps",
  type: "talk",
  mode: "in_person",
  hallId: "3f2b8a10-6c4d-4e57-8b19-0a1d2c3e4f01",
  startAt: "2026-12-12T10:00:00+05:30",
  endAt: "2026-12-12T11:00:00+05:30",
  speakers: [{ speakerId: "4a5b6c7d-8e9f-4a0b-9c1d-2e3f4a5b6c7d" }],
};

describe("what a change to a session refreshes", () => {
  /** The list, that session's details, and the event's own pages; never another event's. */
  function expectSessionAndEventRefreshed(
    isStale: (key: readonly unknown[]) => boolean,
  ) {
    expect(isStale(sessionQueryKeys.list(eventId))).toBe(true);
    expect(isStale(sessionQueryKeys.detail(eventId, sessionId))).toBe(true);
    // The event's session counts and publish checklist depend on its sessions.
    expect(isStale(eventQueryKeys.overview(eventId))).toBe(true);
    expect(isStale(eventQueryKeys.counts)).toBe(true);
    expect(isStale(eventQueryKeys.lists)).toBe(true);
    // The event's public page lists its scheduled sessions: title, time, hall, price, speakers.
    expect(isStale(eventQueryKeys.publicDetail("pune-tech"))).toBe(true);
    // Another event, and a session of this event nobody touched, are not affected.
    expect(isStale(sessionQueryKeys.list(otherEventId))).toBe(false);
    expect(isStale(eventQueryKeys.overview(otherEventId))).toBe(false);
    expect(isStale(sessionQueryKeys.detail(eventId, otherSessionId))).toBe(
      false,
    );
  }

  it("creating refreshes the list, the new session's details and the event's pages", async () => {
    api.create.mockResolvedValue(session);
    const { wrapper, isStale } = setup();
    const { result } = renderHook(() => useCreateSession(eventId), { wrapper });

    await act(() => result.current.mutateAsync(newSession));

    expect(api.create).toHaveBeenCalledWith(eventId, newSession);
    expectSessionAndEventRefreshed(isStale);
  });

  it("shares its root key with the events feature, which reloads every sessions query when an event is cancelled", () => {
    expect(sessionQueryKeys.all).toEqual(SESSIONS_QUERY_ROOT);
  });

  it("creating puts the new session where its edit page looks, so that page opens with its name at once", async () => {
    const created = { ...session, id: otherSessionId, title: "Brand new" };
    api.create.mockResolvedValue(created);
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useCreateSession(eventId), { wrapper });

    await act(() => result.current.mutateAsync(newSession));

    expect(
      queryClient.getQueryData(sessionQueryKeys.detail(eventId, created.id)),
    ).toEqual(created);
  });

  it("creating refreshes nothing when it fails (e.g. the hall is busy)", async () => {
    api.create.mockRejectedValue(new ApiError(409, "HALL_BUSY", "busy"));
    const { wrapper, isStale } = setup();
    const { result } = renderHook(() => useCreateSession(eventId), { wrapper });

    await act(() =>
      result.current.mutateAsync(newSession).catch(() => undefined),
    );

    expect(isStale(sessionQueryKeys.list(eventId))).toBe(false);
    expect(isStale(eventQueryKeys.overview(eventId))).toBe(false);
    expect(isStale(eventQueryKeys.publicDetail("pune-tech"))).toBe(false);
  });

  it("editing refreshes the list, that session and the event's pages", async () => {
    api.update.mockResolvedValue(session);
    const { wrapper, isStale } = setup();
    const { result } = renderHook(() => useUpdateSession(eventId, sessionId), {
      wrapper,
    });

    await act(() => result.current.mutateAsync({ title: "New title" }));

    expect(api.update).toHaveBeenCalledWith(eventId, sessionId, {
      title: "New title",
    });
    expectSessionAndEventRefreshed(isStale);
  });

  it("changing the speakers refreshes the list (it shows their names) and the details", async () => {
    api.replaceSpeakers.mockResolvedValue(session);
    const { wrapper, isStale } = setup();
    const { result } = renderHook(
      () => useReplaceSessionSpeakers(eventId, sessionId),
      { wrapper },
    );

    await act(() =>
      result.current.mutateAsync({
        speakers: [{ speakerId: "4a5b6c7d-8e9f-4a0b-9c1d-2e3f4a5b6c7d" }],
      }),
    );

    expectSessionAndEventRefreshed(isStale);
  });

  it("cancelling takes the session id as the variable and refreshes that session", async () => {
    api.cancel.mockResolvedValue({ ...session, status: "cancelled" });
    const { wrapper, isStale } = setup();
    const { result } = renderHook(() => useCancelSession(eventId), { wrapper });

    await act(() => result.current.mutateAsync(sessionId));

    expect(api.cancel).toHaveBeenCalledWith(eventId, sessionId);
    expectSessionAndEventRefreshed(isStale);
  });
});

describe("what a change to a session's content refreshes", () => {
  it("saving the text puts the answer in the cache and refreshes only the content", async () => {
    const saved = { ...content, description: "New text" };
    api.updateContent.mockResolvedValue(saved);
    const { queryClient, wrapper, isStale } = setup();
    const { result } = renderHook(
      () => useUpdateSessionContent(eventId, sessionId),
      { wrapper },
    );

    await act(() => result.current.mutateAsync({ description: "New text" }));

    expect(api.updateContent).toHaveBeenCalledWith(eventId, sessionId, {
      description: "New text",
    });
    expect(
      queryClient.getQueryData(sessionQueryKeys.content(eventId, sessionId)),
    ).toEqual(saved);
    expect(isStale(sessionQueryKeys.content(eventId, sessionId))).toBe(true);
    // The list and the event's pages read from Postgres, which did not change.
    expect(isStale(sessionQueryKeys.list(eventId))).toBe(false);
    expect(isStale(eventQueryKeys.overview(eventId))).toBe(false);
  });

  it("uploading a cover refreshes only the content, under the media mutation key", async () => {
    api.uploadCover.mockResolvedValue({ coverImage: null });
    const { wrapper, isStale } = setup();
    const { result } = renderHook(
      () => useUploadSessionCover(eventId, sessionId),
      { wrapper },
    );
    const file = new File(["x"], "cover.png", { type: "image/png" });

    await act(() => result.current.mutateAsync(file));

    expect(api.uploadCover).toHaveBeenCalledWith(eventId, sessionId, file);
    expect(isStale(sessionQueryKeys.content(eventId, sessionId))).toBe(true);
    expect(isStale(sessionQueryKeys.list(eventId))).toBe(false);
  });

  it("removing the cover refreshes only the content", async () => {
    api.deleteCover.mockResolvedValue(undefined);
    const { wrapper, isStale } = setup();
    const { result } = renderHook(
      () => useDeleteSessionCover(eventId, sessionId),
      { wrapper },
    );

    await act(() => result.current.mutateAsync());

    expect(api.deleteCover).toHaveBeenCalledWith(eventId, sessionId);
    expect(isStale(sessionQueryKeys.content(eventId, sessionId))).toBe(true);
    expect(isStale(sessionQueryKeys.list(eventId))).toBe(false);
  });

  it("names the media mutations per session, so one screen can ask 'is an upload running?'", () => {
    expect(sessionMutationKeys.media(eventId, sessionId)).toEqual([
      "sessions",
      "media",
      eventId,
      sessionId,
    ]);
    expect(sessionMutationKeys.media(eventId, sessionId)).not.toEqual(
      sessionMutationKeys.media(eventId, otherSessionId),
    );
  });
});

describe("reading", () => {
  /** A client with nothing cached, so the hook really asks the service. */
  function emptySetup() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    return { wrapper };
  }

  it("useGetEventSessions asks for the event's list under the list key", async () => {
    api.listForEvent.mockResolvedValue([session]);
    const { wrapper } = emptySetup();

    const { result } = renderHook(() => useGetEventSessions(eventId), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.listForEvent).toHaveBeenCalledWith(eventId);
    expect(result.current.data).toEqual([session]);
  });

  it("useGetSession asks for one session", async () => {
    api.get.mockResolvedValue(session);
    const { wrapper } = emptySetup();

    const { result } = renderHook(() => useGetSession(eventId, sessionId), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith(eventId, sessionId);
  });

  it("useGetSessionContent asks for the session's content", async () => {
    api.getContent.mockResolvedValue(content);
    const { wrapper } = emptySetup();

    const { result } = renderHook(
      () => useGetSessionContent(eventId, sessionId),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(content);
  });

  it("a 404 is a final answer: it is not asked again", async () => {
    api.get.mockRejectedValue(
      new ApiError(404, "NOT_FOUND", "Session not found"),
    );
    // Use the hook's own retry rule (the client here would otherwise never retry).
    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useGetSession(eventId, sessionId), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(api.get).toHaveBeenCalledTimes(1);
  });
});
