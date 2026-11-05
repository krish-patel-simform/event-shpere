// Calls to the organizer's sessions API, built on the shared axios instance. React Query hooks
// (../hooks) wrap these; components use the hooks. Every answer is parsed with the same schema the
// server responds with. A session always lives under its event: /events/[eventId]/sessions/...
import { apiRequest } from "../../../core/api-client/base-api.service";
import { fileUploadRequest } from "../../../core/api-client/file-upload";
import { SESSION_COVER_FORM_FIELD } from "../constants";
import {
  sessionContentResponseSchema,
  sessionCoverResponseSchema,
  type SessionContentDto,
  type SessionCoverDto,
  type UpdateSessionContentRequest,
} from "../schemas/session-content.schemas";
import {
  sessionListResponseSchema,
  sessionResponseSchema,
  type CreateSessionRequest,
  type ReplaceSessionSpeakersRequest,
  type SessionDto,
  type UpdateSessionRequest,
} from "../schemas/sessions.schemas";

const sessionsUrl = (eventId: string) => `/events/${eventId}/sessions`;
const sessionUrl = (eventId: string, sessionId: string) =>
  `${sessionsUrl(eventId)}/${sessionId}`;

export const sessionApiService = {
  /** Every session of the event, earliest first (404 if the event is not the caller's). */
  listForEvent(eventId: string): Promise<SessionDto[]> {
    return apiRequest(
      { method: "GET", url: sessionsUrl(eventId) },
      sessionListResponseSchema,
    );
  },

  /** One session (404 if it is not in this event). */
  get(eventId: string, sessionId: string): Promise<SessionDto> {
    return apiRequest(
      { method: "GET", url: sessionUrl(eventId, sessionId) },
      sessionResponseSchema,
    );
  },

  /**
   * Adds a session with its speakers. 409 `HALL_BUSY` (with the busy times in `details`) when the
   * hall is taken, 409 `SPEAKER_BUSY` (with the speaker and the busy times) when a speaker is on
   * another session at that time, 409 `HALL_INACTIVE`, 400 when a speaker does not exist, 503 `CMS_UNAVAILABLE`
   * when its content entry could not be created.
   */
  create(eventId: string, body: CreateSessionRequest): Promise<SessionDto> {
    return apiRequest(
      { method: "POST", url: sessionsUrl(eventId), data: body },
      sessionResponseSchema,
    );
  },

  /**
   * Edits or moves a session: only the fields in the body change, and `null` clears the hall or
   * the join link. 409 with a code when the session cannot take the change (`HALL_BUSY`,
   * `SPEAKER_BUSY`, `SESSION_CANCELLED`, `SESSION_ENDED`, `SESSION_HAS_BOOKINGS`, `HALL_TOO_SMALL`).
   */
  update(
    eventId: string,
    sessionId: string,
    body: UpdateSessionRequest,
  ): Promise<SessionDto> {
    return apiRequest(
      { method: "PATCH", url: sessionUrl(eventId, sessionId), data: body },
      sessionResponseSchema,
    );
  },

  /** Replaces who presents the session: the whole list is sent, whoever is not in it is removed. */
  replaceSpeakers(
    eventId: string,
    sessionId: string,
    body: ReplaceSessionSpeakersRequest,
  ): Promise<SessionDto> {
    return apiRequest(
      {
        method: "PUT",
        url: `${sessionUrl(eventId, sessionId)}/speakers`,
        data: body,
      },
      sessionResponseSchema,
    );
  },

  /** Cancels the session (final): its hall is free again and its seats are cancelled. */
  cancel(eventId: string, sessionId: string): Promise<SessionDto> {
    return apiRequest(
      { method: "POST", url: `${sessionUrl(eventId, sessionId)}/cancel` },
      sessionResponseSchema,
    );
  },

  /** The session's text content and cover (Strapi). */
  getContent(eventId: string, sessionId: string): Promise<SessionContentDto> {
    return apiRequest(
      { method: "GET", url: `${sessionUrl(eventId, sessionId)}/content` },
      sessionContentResponseSchema,
    );
  },

  /** Saves the text content. Only the fields in the body change. */
  updateContent(
    eventId: string,
    sessionId: string,
    body: UpdateSessionContentRequest,
  ): Promise<SessionContentDto> {
    return apiRequest(
      {
        method: "PATCH",
        url: `${sessionUrl(eventId, sessionId)}/content`,
        data: body,
      },
      sessionContentResponseSchema,
    );
  },

  /** Sets or replaces the cover image. */
  uploadCover(
    eventId: string,
    sessionId: string,
    file: File,
  ): Promise<SessionCoverDto> {
    return apiRequest(
      fileUploadRequest(
        `${sessionUrl(eventId, sessionId)}/cover`,
        SESSION_COVER_FORM_FIELD,
        file,
      ),
      sessionCoverResponseSchema,
    );
  },

  /** Removes the cover image (204, no body). */
  deleteCover(eventId: string, sessionId: string): Promise<void> {
    return apiRequest({
      method: "DELETE",
      url: `${sessionUrl(eventId, sessionId)}/cover`,
    });
  },
};
