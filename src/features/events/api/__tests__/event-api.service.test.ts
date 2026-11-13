import {
  apiRequest,
  apiRequestPage,
} from "../../../../core/api-client/base-api.service";
import { EVENT_IMAGE_FORM_FIELD } from "../../constants";
import {
  eventContentResponseSchema,
  eventCoverResponseSchema,
  eventGalleryResponseSchema,
} from "../../schemas/event-content.schemas";
import {
  eventOverviewSchema,
  eventTabCountsSchema,
  myEventListResponseSchema,
} from "../../schemas/event-manage.schemas";
import {
  publicEventDetailSchema,
  publicEventListResponseSchema,
} from "../../schemas/event-public.schemas";
import { eventResponseSchema } from "../../schemas/events.schemas";
import { eventApiService } from "../event-api.service";

jest.mock("../../../../core/api-client/base-api.service", () => ({
  apiRequest: jest.fn(),
  apiRequestPage: jest.fn(),
}));

const eventId = "8c1f4f6e-2f4b-4c43-9a59-0d6f2a1b7e10";

beforeEach(() => jest.clearAllMocks());

describe("eventApiService", () => {
  it("listPublic sends only the filters that are set, and parses the public list schema", () => {
    eventApiService.listPublic({
      search: "summit",
      price: "free",
      when: "past",
      sort: "popular",
      page: 2,
      pageSize: 12,
    });
    eventApiService.listPublic({ search: "", pageSize: 12 });

    expect(apiRequestPage).toHaveBeenNthCalledWith(
      1,
      {
        method: "GET",
        url: "/events",
        params: {
          page: 2,
          pageSize: 12,
          search: "summit",
          price: "free",
          when: "past",
          sort: "popular",
        },
      },
      publicEventListResponseSchema,
    );
    // Nothing set: the server's defaults apply.
    expect((apiRequestPage as jest.Mock).mock.calls[1][0].params).toEqual({
      page: 1,
      pageSize: 12,
    });
  });

  it("getPublic reads one event by its slug and parses the public detail schema", () => {
    eventApiService.getPublic("design-systems-day");

    expect(apiRequest).toHaveBeenCalledWith(
      { method: "GET", url: "/events/slug/design-systems-day" },
      publicEventDetailSchema,
    );
  });

  it("listMine asks for a page of the caller's events and parses the list schema", () => {
    eventApiService.listMine({
      status: "published",
      sort: "soonest",
      page: 2,
      pageSize: 10,
    });

    expect(apiRequestPage).toHaveBeenCalledWith(
      {
        method: "GET",
        url: "/me/events",
        params: { page: 2, pageSize: 10, status: "published", sort: "soonest" },
      },
      myEventListResponseSchema,
    );
  });

  it("listMine sends the search only when there is one", () => {
    eventApiService.listMine({
      status: "all",
      sort: "latest",
      search: "summit",
      pageSize: 10,
    });
    eventApiService.listMine({
      status: "all",
      sort: "latest",
      search: "",
      pageSize: 10,
    });

    const [first] = (apiRequestPage as jest.Mock).mock.calls[0];
    const [second] = (apiRequestPage as jest.Mock).mock.calls[1];
    expect(first.params).toEqual({
      page: 1,
      pageSize: 10,
      status: "all",
      sort: "latest",
      search: "summit",
    });
    // An empty search is left out, so the server does not filter by it.
    expect(second.params).not.toHaveProperty("search");
  });

  it("countMine reads the tab counts", () => {
    eventApiService.countMine();

    expect(apiRequest).toHaveBeenCalledWith(
      { method: "GET", url: "/me/events/counts" },
      eventTabCountsSchema,
    );
  });

  it("getOverview reads one event and parses the overview schema", () => {
    eventApiService.getOverview(eventId);

    expect(apiRequest).toHaveBeenCalledWith(
      { method: "GET", url: `/events/${eventId}` },
      eventOverviewSchema,
    );
  });

  it("create posts the body", () => {
    const body = {
      title: "Tech Conf",
      startAt: "2026-12-12T09:30:00+05:30",
      endAt: "2026-12-12T17:30:00+05:30",
    };

    eventApiService.create(body);

    expect(apiRequest).toHaveBeenCalledWith(
      { method: "POST", url: "/events", data: body },
      eventResponseSchema,
    );
  });

  it("update patches the event with the body", () => {
    eventApiService.update(eventId, { title: "New title", venueId: null });

    expect(apiRequest).toHaveBeenCalledWith(
      {
        method: "PATCH",
        url: `/events/${eventId}`,
        data: { title: "New title", venueId: null },
      },
      eventResponseSchema,
    );
  });

  it("cancel posts to the event's cancel endpoint, with no body", () => {
    eventApiService.cancel(eventId);

    expect(apiRequest).toHaveBeenCalledWith(
      { method: "POST", url: `/events/${eventId}/cancel` },
      eventResponseSchema,
    );
  });

  it("remove sends DELETE to the event, with no body and no response to parse", () => {
    eventApiService.remove(eventId);

    expect(apiRequest).toHaveBeenCalledWith({
      method: "DELETE",
      url: `/events/${eventId}`,
    });
  });

  it("publish posts to the event's publish endpoint, with no body", () => {
    eventApiService.publish(eventId);

    expect(apiRequest).toHaveBeenCalledWith(
      { method: "POST", url: `/events/${eventId}/publish` },
      eventResponseSchema,
    );
  });

  it("getContent reads the page content and parses the content schema", () => {
    eventApiService.getContent(eventId);

    expect(apiRequest).toHaveBeenCalledWith(
      { method: "GET", url: `/events/${eventId}/content` },
      eventContentResponseSchema,
    );
  });

  it("updateContent patches the content with the body", () => {
    eventApiService.updateContent(eventId, { tagline: "Two days of talks" });

    expect(apiRequest).toHaveBeenCalledWith(
      {
        method: "PATCH",
        url: `/events/${eventId}/content`,
        data: { tagline: "Two days of talks" },
      },
      eventContentResponseSchema,
    );
  });

  describe("image uploads", () => {
    const file = new File(["x"], "cover.png", { type: "image/png" });

    /** The request config of the call, with the multipart body opened up. */
    function sentUpload() {
      const [config, schema] = (apiRequest as jest.Mock).mock.calls[0];
      return { config, schema, data: config.data as FormData };
    }

    it("uploadCover posts the file in the form field the server reads", () => {
      eventApiService.uploadCover(eventId, file);

      const { config, schema, data } = sentUpload();
      expect(config.method).toBe("POST");
      expect(config.url).toBe(`/events/${eventId}/cover`);
      expect(data.get(EVENT_IMAGE_FORM_FIELD)).toBe(file);
      expect(schema).toBe(eventCoverResponseSchema);
    });

    it("clears the JSON content type, so the browser adds the multipart boundary", () => {
      eventApiService.uploadCover(eventId, file);

      expect(sentUpload().config.headers).toEqual({
        "Content-Type": undefined,
      });
    });

    it("addGalleryImages posts one file to the gallery", () => {
      eventApiService.addGalleryImages(eventId, [file]);

      const { config, schema, data } = sentUpload();
      expect(config.method).toBe("POST");
      expect(config.url).toBe(`/events/${eventId}/gallery`);
      expect(data.get(EVENT_IMAGE_FORM_FIELD)).toBe(file);
      expect(schema).toBe(eventGalleryResponseSchema);
    });

    it("addGalleryImages posts several files in ONE request, in order", () => {
      const second = new File(["y"], "second.png", { type: "image/png" });
      const third = new File(["z"], "third.png", { type: "image/png" });

      eventApiService.addGalleryImages(eventId, [file, second, third]);

      expect(apiRequest).toHaveBeenCalledTimes(1);
      const { data } = sentUpload();
      expect(data.getAll(EVENT_IMAGE_FORM_FIELD)).toEqual([
        file,
        second,
        third,
      ]);
    });
  });

  it("deleteCover deletes and parses nothing (204)", () => {
    eventApiService.deleteCover(eventId);

    expect(apiRequest).toHaveBeenCalledWith({
      method: "DELETE",
      url: `/events/${eventId}/cover`,
    });
  });

  it("deleteGalleryImage deletes one file and parses the gallery that is left", () => {
    eventApiService.deleteGalleryImage(eventId, 42);

    expect(apiRequest).toHaveBeenCalledWith(
      { method: "DELETE", url: `/events/${eventId}/gallery/42` },
      eventGalleryResponseSchema,
    );
  });
});
