/** @jest-environment jsdom */
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { eventApiService } from "../../api/event-api.service";
import type { EventContentDto } from "../../schemas/event-content.schemas";
import type { EventDto } from "../../schemas/events.schemas";
import { eventQueryKeys } from "../event-cache";
import { useAddGalleryImages } from "../useAddGalleryImages";
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
    addGalleryImages: jest.fn(),
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
  // The overview holds two flags about the content (the stepper ticks and the checklist).
  queryClient.setQueryData(eventQueryKeys.overview(eventId), {
    content: { hasDescription: true, hasBanner: false },
  });
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

/**
 * What the open edit page does: it keeps the content and the overview in use. Their fetch
 * functions are counted, so a test can say which one was requested. `stored` is what the content
 * request answers (what the database holds). They never go stale on their own here, so only a
 * save can make them fetch.
 */
function useOpenPage(stored: EventContentDto = savedContent) {
  const fetchContent = jest.fn().mockResolvedValue(stored);
  const fetchOverview = jest.fn();
  return {
    fetchContent,
    fetchOverview,
    use: () => {
      useQuery({
        queryKey: eventQueryKeys.content(eventId),
        queryFn: fetchContent,
        staleTime: Infinity,
      });
      useQuery({
        queryKey: eventQueryKeys.overview(eventId),
        queryFn: fetchOverview,
        staleTime: Infinity,
      });
    },
  };
}

describe("saving the page content (step 2)", () => {
  it("reads the content again to match what is stored, and does NOT read the overview", async () => {
    const saved = { ...savedContent, tagline: "A new tagline" };
    api.updateContent.mockResolvedValue(saved);
    const { queryClient, wrapper, isStale } = setup();
    const page = useOpenPage(saved);
    const { result } = renderHook(
      () => {
        page.use();
        return useUpdateEventContent(eventId);
      },
      { wrapper },
    );

    await act(() => result.current.mutateAsync({ tagline: "A new tagline" }));

    expect(page.fetchContent).toHaveBeenCalledTimes(1);
    expect(page.fetchOverview).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(eventQueryKeys.content(eventId))).toEqual(
      saved,
    );
    expect(isStale(eventQueryKeys.overview(eventId))).toBe(false);
  });

  it("shows what is stored when it differs from what the save answered", async () => {
    api.updateContent.mockResolvedValue({
      ...savedContent,
      tagline: "As answered",
    });
    const { queryClient, wrapper } = setup();
    const page = useOpenPage({ ...savedContent, tagline: "As stored" });
    const { result } = renderHook(
      () => {
        page.use();
        return useUpdateEventContent(eventId);
      },
      { wrapper },
    );

    await act(() => result.current.mutateAsync({ tagline: "x" }));

    expect(
      queryClient.getQueryData<EventContentDto>(eventQueryKeys.content(eventId))
        ?.tagline,
    ).toBe("As stored");
  });

  it("works the overview's flag out from what is stored, not only from the answer", async () => {
    // The save answered with a description, but the database holds none.
    api.updateContent.mockResolvedValue({ ...savedContent, about: "Answered" });
    const { queryClient, wrapper } = setup();
    const page = useOpenPage({ ...savedContent, about: "" });
    const { result } = renderHook(
      () => {
        page.use();
        return useUpdateEventContent(eventId);
      },
      { wrapper },
    );

    await act(() => result.current.mutateAsync({ about: "Answered" }));

    expect(
      queryClient.getQueryData<{ content: { hasDescription: boolean } }>(
        eventQueryKeys.overview(eventId),
      )?.content.hasDescription,
    ).toBe(false);
  });

  it("keeps the saved content on screen when the read afterwards fails", async () => {
    const saved = { ...savedContent, tagline: "A new tagline" };
    api.updateContent.mockResolvedValue(saved);
    const { queryClient, wrapper } = setup();
    const page = useOpenPage();
    page.fetchContent.mockRejectedValue(new Error("network"));
    const { result } = renderHook(
      () => {
        page.use();
        return useUpdateEventContent(eventId);
      },
      { wrapper },
    );

    await act(() => result.current.mutateAsync({ tagline: "A new tagline" }));

    expect(queryClient.getQueryData(eventQueryKeys.content(eventId))).toEqual(
      saved,
    );
  });

  it("updates the overview's description flag from the saved text", async () => {
    api.updateContent.mockResolvedValue({ ...savedContent, about: "   " });
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useUpdateEventContent(eventId), {
      wrapper,
    });

    await act(() => result.current.mutateAsync({ about: "" }));

    // A blank description is not a description.
    expect(
      queryClient.getQueryData<{ content: unknown }>(
        eventQueryKeys.overview(eventId),
      )?.content,
    ).toEqual({ hasDescription: false, hasBanner: false });
  });

  it("keeps the rest of the overview as it was", async () => {
    api.updateContent.mockResolvedValue(savedContent);
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(eventQueryKeys.overview(eventId), {
      event: { title: "Tech Conf" },
      hallCount: 4,
      content: { hasDescription: false, hasBanner: true },
    });
    const { result } = renderHook(() => useUpdateEventContent(eventId), {
      wrapper,
    });

    await act(() => result.current.mutateAsync({ tagline: "x" }));

    expect(queryClient.getQueryData(eventQueryKeys.overview(eventId))).toEqual({
      event: { title: "Tech Conf" },
      hallCount: 4,
      content: { hasDescription: true, hasBanner: false },
    });
  });

  it("does not make up an overview that was never loaded", async () => {
    api.updateContent.mockResolvedValue(savedContent);
    const { queryClient, wrapper } = setup();
    queryClient.removeQueries({ queryKey: eventQueryKeys.overview(eventId) });
    const { result } = renderHook(() => useUpdateEventContent(eventId), {
      wrapper,
    });

    await act(() => result.current.mutateAsync({ tagline: "x" }));

    expect(
      queryClient.getQueryData(eventQueryKeys.overview(eventId)),
    ).toBeUndefined();
  });

  it("does not leave another event's cache touched", async () => {
    api.updateContent.mockResolvedValue(savedContent);
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useUpdateEventContent(eventId), {
      wrapper,
    });

    await act(() => result.current.mutateAsync({ tagline: "x" }));

    expect(
      queryClient.getQueryData(eventQueryKeys.overview(otherEventId)),
    ).toEqual({});
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

  const cover = {
    id: 5,
    url: "https://cms.example.com/uploads/cover.jpg",
    alt: null,
    width: 1200,
    height: 630,
  };
  const photo = (id: number) => ({ ...cover, id });

  /** Each action, what the server answers, and what the cached content must hold afterwards. */
  const cases: {
    name: string;
    run: (hooks: {
      cover: ReturnType<typeof useUploadEventCover>;
      removeCover: ReturnType<typeof useDeleteEventCover>;
      add: ReturnType<typeof useAddGalleryImages>;
      removeImage: ReturnType<typeof useDeleteGalleryImage>;
    }) => Promise<unknown>;
    arrange: () => void;
    expected: Partial<EventContentDto>;
    /** The overview's banner flag afterwards. */
    hasBanner: boolean;
  }[] = [
    {
      name: "uploading a cover",
      arrange: () => api.uploadCover.mockResolvedValue({ coverImage: cover }),
      run: (hooks) => hooks.cover.mutateAsync(file),
      expected: { coverImage: cover },
      hasBanner: true,
    },
    {
      name: "removing the cover",
      arrange: () => api.deleteCover.mockResolvedValue(undefined),
      run: (hooks) => hooks.removeCover.mutateAsync(),
      expected: { coverImage: null },
      hasBanner: false,
    },
    {
      name: "adding gallery images",
      arrange: () =>
        api.addGalleryImages.mockResolvedValue({
          gallery: [photo(1), photo(2)],
        }),
      run: (hooks) => hooks.add.mutateAsync([file]),
      expected: { gallery: [photo(1), photo(2)] },
      hasBanner: false,
    },
    {
      name: "removing a gallery image",
      arrange: () =>
        api.deleteGalleryImage.mockResolvedValue({ gallery: [photo(2)] }),
      run: (hooks) => hooks.removeImage.mutateAsync(1),
      expected: { gallery: [photo(2)] },
      hasBanner: false,
    },
  ];

  it.each(cases)(
    "$name reads the content again, and does NOT read the overview",
    async ({ arrange, run, expected, hasBanner }) => {
      arrange();
      const { queryClient, wrapper, isStale } = setup();
      const page = useOpenPage({ ...savedContent, ...expected });
      const { result } = renderHook(
        () => {
          page.use();
          return {
            cover: useUploadEventCover(eventId),
            removeCover: useDeleteEventCover(eventId),
            add: useAddGalleryImages(eventId),
            removeImage: useDeleteGalleryImage(eventId),
          };
        },
        { wrapper },
      );

      await act(async () => {
        await run(result.current);
      });

      // The rest of the content is what it was; only the changed part is new.
      expect(queryClient.getQueryData(eventQueryKeys.content(eventId))).toEqual(
        { ...savedContent, ...expected },
      );
      // The banner flag follows from the cover, without asking for the overview.
      expect(
        queryClient.getQueryData<{ content: { hasBanner: boolean } }>(
          eventQueryKeys.overview(eventId),
        )?.content.hasBanner,
      ).toBe(hasBanner);
      expect(page.fetchContent).toHaveBeenCalledTimes(1);
      expect(page.fetchOverview).not.toHaveBeenCalled();
      expect(isStale(listKey)).toBe(false);
      expect(isStale(eventQueryKeys.counts)).toBe(false);
    },
  );

  it("keeps both parts when a cover and a gallery upload finish one after the other", async () => {
    api.uploadCover.mockResolvedValue({ coverImage: cover });
    api.addGalleryImages.mockResolvedValue({ gallery: [photo(1)] });
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(
      () => ({
        cover: useUploadEventCover(eventId),
        add: useAddGalleryImages(eventId),
      }),
      { wrapper },
    );

    await act(async () => {
      await result.current.cover.mutateAsync(file);
      await result.current.add.mutateAsync([file]);
    });

    expect(queryClient.getQueryData(eventQueryKeys.content(eventId))).toEqual({
      ...savedContent,
      coverImage: cover,
      gallery: [photo(1)],
    });
  });

  it("asks again when there is no cached content to put the answer into", async () => {
    api.uploadCover.mockResolvedValue({ coverImage: cover });
    const { queryClient, wrapper, isStale } = setup();
    queryClient.removeQueries({ queryKey: eventQueryKeys.content(eventId) });
    const { result } = renderHook(() => useUploadEventCover(eventId), {
      wrapper,
    });

    await act(() => result.current.mutateAsync(file));

    expect(isStale(eventQueryKeys.overview(eventId))).toBe(true);
  });

  it("does not touch the cache when the upload fails", async () => {
    api.uploadCover.mockRejectedValue(new Error("boom"));
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useUploadEventCover(eventId), {
      wrapper,
    });

    await act(() => result.current.mutateAsync(file).catch(() => undefined));

    expect(queryClient.getQueryData(eventQueryKeys.content(eventId))).toEqual(
      savedContent,
    );
    expect(
      queryClient.getQueryData<{ content: { hasBanner: boolean } }>(
        eventQueryKeys.overview(eventId),
      )?.content.hasBanner,
    ).toBe(false);
  });

  it("sends all the chosen files to the API in one call when adding gallery images", async () => {
    api.addGalleryImages.mockResolvedValue({ gallery: [] });
    const second = new File(["y"], "second.png", { type: "image/png" });
    const { wrapper } = setup();
    const { result } = renderHook(() => useAddGalleryImages(eventId), {
      wrapper,
    });

    await act(() => result.current.mutateAsync([file, second]));

    expect(api.addGalleryImages).toHaveBeenCalledTimes(1);
    expect(api.addGalleryImages).toHaveBeenCalledWith(eventId, [file, second]);
  });

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
