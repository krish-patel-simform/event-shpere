// Calls to the speakers API, built on the shared axios instance. React Query hooks (../hooks)
// wrap these; components use the hooks.
import {
  apiRequest,
  apiRequestPage,
} from "../../../core/api-client/base-api.service";
import { fileUploadRequest } from "../../../core/api-client/file-upload";
import {
  resendInviteResponseSchema,
  type ResendInviteResponseDto,
} from "../../auth";
import { SPEAKER_PHOTO_FORM_FIELD } from "../constants";
import {
  speakerSessionsMetaSchema,
  speakerSessionsResponseSchema,
  type ListSpeakerSessionsQuery,
} from "../schemas/speaker-sessions.schemas";
import {
  createSpeakerResponseSchema,
  getSpeakersResponseSchema,
  ownSpeakerProfileResponseSchema,
  speakerPhotoResponseSchema,
  speakerProfileResponseSchema,
  type CreateSpeakerBody,
  type CreateSpeakerResponseDto,
  type ListSpeakersQuery,
  type OwnSpeakerProfileDto,
  type SpeakerPhotoResponseDto,
  type SpeakerProfileDto,
  type UpdateOwnSpeakerProfileBody,
} from "../schemas/speaker.schemas";

export type ListSpeakersParams = Pick<ListSpeakersQuery, "pageSize"> &
  Partial<Pick<ListSpeakersQuery, "page" | "search" | "ids">>;

export type ListSpeakerSessionsParams = Pick<
  ListSpeakerSessionsQuery,
  "timeline"
> &
  Partial<Pick<ListSpeakerSessionsQuery, "page" | "pageSize">>;

export const speakersApiService = {
  /**
   * One category of a speaker's sessions (`timeline`: now, upcoming or past), grouped by event,
   * one page of events. `meta.total` = events and `meta.totalSessions` = sessions in the category.
   * 404 if the speaker is unknown.
   */
  listSessions(
    slug: string,
    { timeline, page = 1, pageSize }: ListSpeakerSessionsParams,
  ) {
    return apiRequestPage(
      {
        method: "GET",
        url: `/speakers/${slug}/sessions`,
        // pageSize is left out when not set, so the server uses its default.
        params: { timeline, page, ...(pageSize ? { pageSize } : {}) },
      },
      speakerSessionsResponseSchema,
      speakerSessionsMetaSchema,
    );
  },

  /**
   * One page of speakers (A–Z), filtered by name by the server, and how many match in total.
   * `ids` limits the list to those speakers (1 to 50).
   */
  list({ search, ids, page = 1, pageSize }: ListSpeakersParams) {
    return apiRequestPage(
      {
        method: "GET",
        url: "/speakers",
        // Only what is set goes into the URL: no search means the server does not filter.
        params: {
          page,
          pageSize,
          ...(search ? { search } : {}),
          ...(ids ? { ids: ids.join(",") } : {}),
        },
      },
      getSpeakersResponseSchema,
    );
  },

  /** One speaker: the name from the database and the whole profile from the CMS (404 if unknown). */
  get(slug: string): Promise<SpeakerProfileDto> {
    return apiRequest(
      { method: "GET", url: `/speakers/${slug}` },
      speakerProfileResponseSchema,
    );
  },

  /**
   * Emails the speaker a NEW set-password invite (the old link stops working). Only for a speaker
   * who has not set a password yet: 409 if they already have, 429 within a minute of the last
   * invite. The answer is only when the link expires: never the link.
   */
  resendInvite(slug: string): Promise<ResendInviteResponseDto> {
    return apiRequest(
      { method: "POST", url: `/speakers/${slug}/resend-invite` },
      resendInviteResponseSchema,
    );
  },

  /** Invites a speaker: an empty profile in the CMS and a set-password email (needs SPEAKER_CREATE). */
  create(body: CreateSpeakerBody): Promise<CreateSpeakerResponseDto> {
    return apiRequest(
      { method: "POST", url: "/speakers", data: body },
      createSpeakerResponseSchema,
    );
  },

  /** The logged-in speaker's own profile, as the edit form's values (needs SPEAKER_MANAGE_OWN). */
  getOwnProfile(): Promise<OwnSpeakerProfileDto> {
    return apiRequest(
      { method: "GET", url: "/me/speaker-profile" },
      ownSpeakerProfileResponseSchema,
    );
  },

  /** Saves the fields in the body (a partial update) and answers with the whole saved profile. */
  updateOwnProfile(
    body: UpdateOwnSpeakerProfileBody,
  ): Promise<OwnSpeakerProfileDto> {
    return apiRequest(
      { method: "PATCH", url: "/me/speaker-profile", data: body },
      ownSpeakerProfileResponseSchema,
    );
  },

  /**
   * Replaces the speaker's photo. The file goes as multipart/form-data in the field the server
   * streams on to the CMS.
   */
  uploadOwnPhoto(file: File): Promise<SpeakerPhotoResponseDto> {
    return apiRequest(
      fileUploadRequest(
        "/me/speaker-profile/photo",
        SPEAKER_PHOTO_FORM_FIELD,
        file,
      ),
      speakerPhotoResponseSchema,
    );
  },
};
