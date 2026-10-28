// Calls to the speakers API, built on the shared axios instance. React Query hooks (../hooks)
// wrap these; components use the hooks.
import {
  apiRequest,
  apiRequestPage,
} from "../../../core/api-client/base-api.service";
import {
  resendInviteResponseSchema,
  type ResendInviteResponseDto,
} from "../../auth";
import { SPEAKER_PHOTO_FORM_FIELD } from "../constants";
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
  Partial<Pick<ListSpeakersQuery, "page" | "search">>;

export const speakersApiService = {
  /** One page of speakers (A–Z), filtered by name by the server, and how many match in total. */
  list({ search, page = 1, pageSize }: ListSpeakersParams) {
    return apiRequestPage(
      {
        method: "GET",
        url: "/speakers",
        // Only what is set goes into the URL: no search means the server does not filter.
        params: { page, pageSize, ...(search ? { search } : {}) },
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
   * streams on to the CMS. The JSON content type of the shared client is cleared, so the browser
   * sets `multipart/form-data` with its boundary itself.
   */
  uploadOwnPhoto(file: File): Promise<SpeakerPhotoResponseDto> {
    const data = new FormData();
    data.append(SPEAKER_PHOTO_FORM_FIELD, file);
    return apiRequest(
      {
        method: "POST",
        url: "/me/speaker-profile/photo",
        data,
        headers: { "Content-Type": undefined },
      },
      speakerPhotoResponseSchema,
    );
  },
};
