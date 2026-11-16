import { apiRequest } from "../../../../core/api-client/base-api.service";
import { SESSION_COVER_FORM_FIELD } from "../../constants";
import {
  sessionContentResponseSchema,
  sessionCoverResponseSchema,
} from "../../schemas/session-content.schemas";
import {
  sessionListResponseSchema,
  sessionResponseSchema,
  type CreateSessionRequest,
} from "../../schemas/sessions.schemas";
import { sessionApiService } from "../session-api.service";

jest.mock("../../../../core/api-client/base-api.service", () => ({
  apiRequest: jest.fn(),
}));

const eventId = "8c1f4f6e-2f4b-4c43-9a59-0d6f2a1b7e10";
const sessionId = "6c7d8e9f-0a1b-4c2d-9e3f-4a5b6c7d8e9f";
const base = `/events/${eventId}/sessions`;

beforeEach(() => jest.clearAllMocks());

/** The config and the schema the last call passed to apiRequest. */
function lastCall() {
  const [config, schema] = (apiRequest as jest.Mock).mock.calls.at(-1) ?? [];
  return { config, schema };
}

describe("sessionApiService", () => {
  it("listForEvent reads the event's sessions and parses the list schema", () => {
    sessionApiService.listForEvent(eventId);

    expect(apiRequest).toHaveBeenCalledWith(
      { method: "GET", url: base },
      sessionListResponseSchema,
    );
  });

  it("get reads one session under its event", () => {
    sessionApiService.get(eventId, sessionId);

    expect(apiRequest).toHaveBeenCalledWith(
      { method: "GET", url: `${base}/${sessionId}` },
      sessionResponseSchema,
    );
  });

  it("create posts the body to the event's sessions", () => {
    const body: CreateSessionRequest = {
      title: "Offline-first Event Apps",
      type: "talk",
      mode: "in_person",
      hallId: "3f2b8a10-6c4d-4e57-8b19-0a1d2c3e4f01",
      startAt: "2026-12-12T10:00:00+05:30",
      endAt: "2026-12-12T11:00:00+05:30",
      speakers: [{ speakerId: "4a5b6c7d-8e9f-4a0b-9c1d-2e3f4a5b6c7d" }],
    };

    sessionApiService.create(eventId, body);

    expect(apiRequest).toHaveBeenCalledWith(
      { method: "POST", url: base, data: body },
      sessionResponseSchema,
    );
  });

  it("update patches the session with only what the body holds", () => {
    sessionApiService.update(eventId, sessionId, { title: "A better title" });

    expect(apiRequest).toHaveBeenCalledWith(
      {
        method: "PATCH",
        url: `${base}/${sessionId}`,
        data: { title: "A better title" },
      },
      sessionResponseSchema,
    );
  });

  it("replaceSpeakers puts the whole list", () => {
    const body = {
      speakers: [{ speakerId: "4a5b6c7d-8e9f-4a0b-9c1d-2e3f4a5b6c7d" }],
    };

    sessionApiService.replaceSpeakers(eventId, sessionId, body);

    expect(apiRequest).toHaveBeenCalledWith(
      { method: "PUT", url: `${base}/${sessionId}/speakers`, data: body },
      sessionResponseSchema,
    );
  });

  it("cancel posts to the cancel action, with no body", () => {
    sessionApiService.cancel(eventId, sessionId);

    expect(apiRequest).toHaveBeenCalledWith(
      { method: "POST", url: `${base}/${sessionId}/cancel` },
      sessionResponseSchema,
    );
  });

  it("getContent reads the session's Strapi content", () => {
    sessionApiService.getContent(eventId, sessionId);

    expect(apiRequest).toHaveBeenCalledWith(
      { method: "GET", url: `${base}/${sessionId}/content` },
      sessionContentResponseSchema,
    );
  });

  it("updateContent patches the content", () => {
    sessionApiService.updateContent(eventId, sessionId, {
      prerequisites: "Know some JS",
    });

    expect(apiRequest).toHaveBeenCalledWith(
      {
        method: "PATCH",
        url: `${base}/${sessionId}/content`,
        data: { prerequisites: "Know some JS" },
      },
      sessionContentResponseSchema,
    );
  });

  describe("the cover", () => {
    const file = new File(["x"], "cover.png", { type: "image/png" });

    it("uploadCover posts the file in the form field the server reads", () => {
      sessionApiService.uploadCover(eventId, sessionId, file);

      const { config, schema } = lastCall();
      expect(config.method).toBe("POST");
      expect(config.url).toBe(`${base}/${sessionId}/cover`);
      expect(config.data.get(SESSION_COVER_FORM_FIELD)).toBe(file);
      expect(schema).toBe(sessionCoverResponseSchema);
    });

    it("clears the JSON content type, so the browser adds the multipart boundary", () => {
      sessionApiService.uploadCover(eventId, sessionId, file);

      expect(lastCall().config.headers).toEqual({ "Content-Type": undefined });
    });

    it("deleteCover deletes and parses nothing (204)", () => {
      sessionApiService.deleteCover(eventId, sessionId);

      expect(apiRequest).toHaveBeenCalledWith({
        method: "DELETE",
        url: `${base}/${sessionId}/cover`,
      });
    });
  });
});
