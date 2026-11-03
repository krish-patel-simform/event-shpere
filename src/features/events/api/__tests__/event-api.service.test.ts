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
import { eventResponseSchema } from "../../schemas/events.schemas";
import { eventApiService } from "../event-api.service";

jest.mock("../../../../core/api-client/base-api.service", () => ({
  apiRequest: jest.fn(),
  apiRequestPage: jest.fn(),
}));

const eventId = "8c1f4f6e-2f4b-4c43-9a59-0d6f2a1b7e10";

beforeEach(() => jest.clearAllMocks());

describe("eventApiService", () => {
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

    it("addGalleryImage posts one file to the gallery", () => {
      eventApiService.addGalleryImage(eventId, file);

      const { config, schema, data } = sentUpload();
      expect(config.method).toBe("POST");
      expect(config.url).toBe(`/events/${eventId}/gallery`);
      expect(data.get(EVENT_IMAGE_FORM_FIELD)).toBe(file);
      expect(schema).toBe(eventGalleryResponseSchema);
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
