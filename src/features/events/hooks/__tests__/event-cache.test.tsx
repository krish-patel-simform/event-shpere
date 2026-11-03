/** @jest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { eventApiService } from "../../api/event-api.service";
import type { EventContentDto } from "../../schemas/event-content.schemas";
import type { EventDto } from "../../schemas/events.schemas";
import { eventQueryKeys } from "../event-cache";
import { useAddGalleryImage } from "../useAddGalleryImage";
import { useCreateEvent } from "../useCreateEvent";
import { useDeleteEventCover } from "../useDeleteEventCover";
import { useDeleteGalleryImage } from "../useDeleteGalleryImage";
import { useUpdateEvent } from "../useUpdateEvent";
import { useUpdateEventContent } from "../useUpdateEventContent";
import { useUploadEventCover } from "../useUploadEventCover";

jest.mock("../../api/event-api.service", () => ({
  eventApiService: {
    create: jest.fn(),
    update: jest.fn(),
    updateContent: jest.fn(),
    uploadCover: jest.fn(),
    deleteCover: jest.fn(),
    addGalleryImage: jest.fn(),
    deleteGalleryImage: jest.fn(),
  },
}));

const api = jest.mocked(eventApiService);

const eventId = "4e5f6a7b-8c9d-4e0f-a1b2-c3d4e5f6a7b8";
const otherEventId = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

const savedEvent: EventDto = {
  id: eventId,
  slug: "tech-conf",
  title: "Tech Conf",
  status: "draft",
  startAt: "2026-12-12T04:00:00.000Z",
  endAt: "2026-12-12T12:00:00.000Z",
  timezone: "Asia/Kolkata",
  venueId: null,
  capacity: null,
  ticketPrice: 0,
  currency: "INR",
  registrationOpensAt: null,
  registrationClosesAt: null,
  publishedAt: null,
  createdAt: "2026-11-02T10:00:00.000Z",
};

const savedContent: EventContentDto = {
  tagline: "Two days of talks",
  about: "About the event",
  venueGuide: "",
  highlights: [],
  faqs: [],
  seo: { metaTitle: null, metaDescription: null },
  coverImage: null,
  gallery: [],
};

const listKey = eventQueryKeys.list({
  status: "all",
  sort: "soonest",
  pageSize: 10,
});

/** A client that already holds what the organizer's screens would have loaded. */
function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(listKey, { items: [], meta: {} });
  queryClient.setQueryData(eventQueryKeys.counts, { all: 0 });
  queryClient.setQueryData(eventQueryKeys.overview(eventId), {});
  queryClient.setQueryData(eventQueryKeys.overview(otherEventId), {});
  queryClient.setQueryData(eventQueryKeys.content(eventId), savedContent);

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const isStale = (key: readonly unknown[]) =>
    queryClient.getQueryState(key)?.isInvalidated === true;
  return { queryClient, wrapper, isStale };
}

beforeEach(() => jest.resetAllMocks());

describe("creating an event", () => {
  it("refreshes the lists, the tab counts and the new event's overview", async () => {
    api.create.mockResolvedValue(savedEvent);
    const { wrapper, isStale } = setup();
    const { result } = renderHook(() => useCreateEvent(), { wrapper });

    await act(() =>
      result.current.mutateAsync({
        title: "Tech Conf",
        startAt: "2026-12-12T09:00:00+05:30",
        endAt: "2026-12-12T17:00:00+05:30",
      }),
    );

    expect(isStale(listKey)).toBe(true);
    expect(isStale(eventQueryKeys.counts)).toBe(true);
    expect(isStale(eventQueryKeys.overview(eventId))).toBe(true);
    // Another event is not affected.
    expect(isStale(eventQueryKeys.overview(otherEventId))).toBe(false);
  });

  it("refreshes nothing when the event could not be created", async () => {
    api.create.mockRejectedValue(new Error("boom"));
    const { wrapper, isStale } = setup();
    const { result } = renderHook(() => useCreateEvent(), { wrapper });

    await act(() =>
      result.current
        .mutateAsync({
          title: "Tech Conf",
          startAt: "2026-12-12T09:00:00+05:30",
          endAt: "2026-12-12T17:00:00+05:30",
        })
        .catch(() => undefined),
    );

    expect(isStale(listKey)).toBe(false);
    expect(isStale(eventQueryKeys.counts)).toBe(false);
  });
});

describe("changing an event's details (step 1 of an existing event)", () => {
  it("refreshes the lists, the tab counts and that event's overview", async () => {
    api.update.mockResolvedValue(savedEvent);
    const { wrapper, isStale } = setup();
    const { result } = renderHook(() => useUpdateEvent(eventId), { wrapper });

    await act(() => result.current.mutateAsync({ title: "New title" }));

    expect(isStale(listKey)).toBe(true);
    expect(isStale(eventQueryKeys.counts)).toBe(true);
    expect(isStale(eventQueryKeys.overview(eventId))).toBe(true);
  });
});

describe("saving the page content (step 2)", () => {
  it("shows the saved content at once, and refreshes the overview's checklist", async () => {
    const saved = { ...savedContent, tagline: "A new tagline" };
    api.updateContent.mockResolvedValue(saved);
    const { queryClient, wrapper, isStale } = setup();
    const { result } = renderHook(() => useUpdateEventContent(eventId), {
      wrapper,
    });

    await act(() => result.current.mutateAsync({ tagline: "A new tagline" }));

    expect(queryClient.getQueryData(eventQueryKeys.content(eventId))).toEqual(
      saved,
    );
    expect(isStale(eventQueryKeys.overview(eventId))).toBe(true);
  });

  it("leaves the lists and the tab counts alone: they do not show the content", async () => {
    api.updateContent.mockResolvedValue(savedContent);
    const { wrapper, isStale } = setup();
    const { result } = renderHook(() => useUpdateEventContent(eventId), {
      wrapper,
    });

    await act(() => result.current.mutateAsync({ tagline: "x" }));

    expect(isStale(listKey)).toBe(false);
    expect(isStale(eventQueryKeys.counts)).toBe(false);
  });
});

describe("changing the images (step 3)", () => {
  const file = new File(["x"], "cover.png", { type: "image/png" });

  const cases: [string, () => void][] = [
    [
      "uploading a cover",
      () => api.uploadCover.mockResolvedValue({ coverImage: null }),
    ],
    ["removing the cover", () => api.deleteCover.mockResolvedValue(undefined)],
    [
      "adding a gallery image",
      () => api.addGalleryImage.mockResolvedValue({ gallery: [] }),
    ],
    [
      "removing a gallery image",
      () => api.deleteGalleryImage.mockResolvedValue({ gallery: [] }),
    ],
  ];

  it.each(cases)(
    "%s refreshes the content and the overview (banner flag), not the lists or counts",
    async (name, arrange) => {
      arrange();
      const { wrapper, isStale } = setup();
      const { result } = renderHook(
        () => ({
          cover: useUploadEventCover(eventId),
          removeCover: useDeleteEventCover(eventId),
          add: useAddGalleryImage(eventId),
          removeImage: useDeleteGalleryImage(eventId),
        }),
        { wrapper },
      );

      await act(async () => {
        if (name === "uploading a cover")
          await result.current.cover.mutateAsync(file);
        if (name === "removing the cover")
          await result.current.removeCover.mutateAsync();
        if (name === "adding a gallery image")
          await result.current.add.mutateAsync(file);
        if (name === "removing a gallery image")
          await result.current.removeImage.mutateAsync(7);
      });

      expect(isStale(eventQueryKeys.content(eventId))).toBe(true);
      expect(isStale(eventQueryKeys.overview(eventId))).toBe(true);
      expect(isStale(listKey)).toBe(false);
      expect(isStale(eventQueryKeys.counts)).toBe(false);
    },
  );

  it("sends the gallery image's id to the API when removing it", async () => {
    api.deleteGalleryImage.mockResolvedValue({ gallery: [] });
    const { wrapper } = setup();
    const { result } = renderHook(() => useDeleteGalleryImage(eventId), {
      wrapper,
    });

    await act(() => result.current.mutateAsync(7));

    expect(api.deleteGalleryImage).toHaveBeenCalledWith(eventId, 7);
  });
});
