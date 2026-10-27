import "server-only";
import { env } from "../../../config/env";
import type { CurrentUser } from "../../../core/auth/server/auth-session";
// Direct file import: the core/http barrel also pulls in the route wrapper and cookies.
import {
  ConflictError,
  NotFoundError,
  ServiceUnavailableError,
  ValidationError,
} from "../../../core/http/errors";
import type { PageMeta } from "../../../core/http/response";
import {
  ACCOUNT_SETUP_TOKEN_TTL_HOURS,
  type ResendInviteResponseDto,
} from "../../auth";
import {
  accountInviteService,
  createAccountSetupToken,
  type AccountInviteService,
} from "../../auth/server";
import type { CmsSpeaker, StrapiSpeakerUpdate } from "../../cms";
import {
  strapiSpeakerClient,
  type StrapiSpeakerClient,
} from "../../cms/server";
import { enqueueAccountSetupEmail } from "../../email/server";
import {
  organizerService,
  type OrganizerService,
} from "../../organizer/server";
import type {
  CreateSpeakerBody,
  CreateSpeakerResponseDto,
  ListSpeakersQuery,
  OwnSpeakerProfileDto,
  SpeakerListItemDto,
  SpeakerPhotoResponseDto,
  SpeakerProfileDto,
  UpdateOwnSpeakerProfileBody,
} from "../schemas/speaker.schemas";
import { textToBlocks } from "../utils/bio-blocks";
import {
  toExistingSpeakerDto,
  toOwnSpeakerProfileDto,
  toPhotoDto,
  toSpeakerDto,
  toSpeakerListItemDto,
  toSpeakerProfileDto,
} from "./speaker.dto";
import {
  speakerRepository,
  type OwnSpeakerRow,
  type SpeakerRepository,
} from "./speaker.repository";
import {
  createByteLimit,
  isAcceptablePhoto,
  SPEAKER_PHOTO_MAX_BODY_BYTES,
} from "./speaker-photo";
import { createSpeakerSlug } from "./speaker-slug";

export type SpeakerServiceDeps = {
  speakerRepository: Pick<
    SpeakerRepository,
    | "findAccountByEmail"
    | "createSpeaker"
    | "listSpeakers"
    | "findBySlug"
    | "findOwnSpeaker"
    | "updateNames"
    | "setCmsSpeakerId"
    | "findInviteeBySlug"
  >;
  createAccountSetupToken: typeof createAccountSetupToken;
  enqueueAccountSetupEmail: typeof enqueueAccountSetupEmail;
  accountInviteService: Pick<AccountInviteService, "resendAccountSetup">;
  strapiClient: Pick<
    StrapiSpeakerClient,
    | "createSpeaker"
    | "deleteSpeaker"
    | "findSpeakersByIds"
    | "findSpeakerById"
    | "updateSpeaker"
    | "uploadFiles"
    | "deleteFile"
  >;
  createSlug: typeof createSpeakerSlug;
  appUrl: string;
  /** Organizers may invite speakers only once an admin has approved them. */
  organizerVerification: Pick<OrganizerService, "assertVerifiedOrganizer">;
};

/** The signed-in user doing the invite: an organizer or an admin. */
type Inviter = Pick<CurrentUser, "id" | "role">;

/** The photo upload as it arrived: streamed on to Strapi, never stored here. */
export type PhotoUpload = {
  body: ReadableStream<Uint8Array>;
  /** The original "multipart/form-data; boundary=..." header. */
  contentType: string;
};

// Does not say which role owns the email: anyone with SPEAKER_CREATE could otherwise probe
// emails to find organizer and admin accounts.
const emailTaken = () =>
  new ConflictError(
    "EMAIL_TAKEN",
    "This email is already used by another EventSphere account and can't be added as a speaker.",
  );

const cmsUnavailable = () =>
  new ServiceUnavailableError(
    "CMS_UNAVAILABLE",
    "Your speaker profile is not available right now. Please try again.",
  );

const invalidPhoto = () =>
  new ValidationError(
    "The photo must be one JPEG, PNG or WebP image of at most 2 MB",
  );

/**
 * Only the fields present in the body. A missing (undefined) field must never reach Strapi:
 * it means "leave as is", while null means "clear".
 */
function toStrapiUpdate(
  body: UpdateOwnSpeakerProfileBody,
): StrapiSpeakerUpdate {
  const data: StrapiSpeakerUpdate = {};
  if (body.jobTitle !== undefined) data.jobTitle = body.jobTitle;
  if (body.company !== undefined) data.company = body.company;
  if (body.bio !== undefined) {
    const blocks = body.bio ? textToBlocks(body.bio) : [];
    data.bio = blocks.length > 0 ? blocks : null;
  }
  if (body.expertise !== undefined) data.expertise = body.expertise;
  if (body.linkedinUrl !== undefined) data.linkedinUrl = body.linkedinUrl;
  if (body.twitterUrl !== undefined) data.twitterUrl = body.twitterUrl;
  if (body.websiteUrl !== undefined) data.websiteUrl = body.websiteUrl;
  return data;
}

export function createSpeakerService(deps: SpeakerServiceDeps) {
  /**
   * Throws when the email is already used:
   * - by a speaker → 409 SPEAKER_EXISTS with their basic details (the UI shows that speaker)
   * - by any other account → 409 EMAIL_TAKEN, no details
   */
  async function assertEmailFree(email: string) {
    const account = await deps.speakerRepository.findAccountByEmail(email);
    if (!account) return;
    if (account.speaker) {
      throw new ConflictError(
        "SPEAKER_EXISTS",
        "A speaker with this email already exists",
        { speaker: toExistingSpeakerDto(account.speaker) },
      );
    }
    throw emailTaken();
  }

  /** The empty, published Speaker entry in Strapi. Any failure → 503, nothing saved. */
  async function createCmsSpeaker(name: string) {
    try {
      return await deps.strapiClient.createSpeaker({ name });
    } catch (error) {
      console.error(
        "[speakers] Strapi speaker not created:",
        error instanceof Error ? error.message : error,
      );
      throw new ServiceUnavailableError(
        "CMS_UNAVAILABLE",
        "Could not create the speaker right now. Please try again.",
      );
    }
  }

  /**
   * Undo for createCmsSpeaker when the DB insert did not happen. Best effort: if it fails too,
   * an unused entry stays in Strapi. No speaker_profiles row points to it, so EventSphere
   * pages never show it; log its id so it can be removed by hand.
   */
  async function removeCmsSpeaker(documentId: string) {
    try {
      await deps.strapiClient.deleteSpeaker(documentId);
    } catch (error) {
      console.error(
        `[speakers] orphan Strapi speaker ${documentId} not deleted:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  /** The logged-in user's speaker profile. Not a speaker → 404. */
  async function requireOwnSpeaker(userId: string): Promise<OwnSpeakerRow> {
    const speaker = await deps.speakerRepository.findOwnSpeaker(userId);
    if (!speaker) throw new NotFoundError("Speaker profile not found");
    return speaker;
  }

  /** A Strapi call the request cannot do without: any failure → 503, and the caller stops. */
  async function requireCms<T>(
    what: string,
    call: () => Promise<T>,
  ): Promise<T> {
    try {
      return await call();
    } catch (error) {
      console.error(
        `[speakers] Strapi ${what} failed:`,
        error instanceof Error ? error.message : error,
      );
      throw cmsUnavailable();
    }
  }

  /**
   * The speaker's current Strapi content for the edit form. Unlike the public pages, a
   * Strapi failure is a 503 here: an empty form saved back would wipe the real profile.
   */
  async function loadOwnCms(
    speaker: OwnSpeakerRow,
  ): Promise<CmsSpeaker | null> {
    const { cmsSpeakerId } = speaker;
    if (!cmsSpeakerId) return null;
    return requireCms("load", () =>
      deps.strapiClient.findSpeakerById(cmsSpeakerId),
    );
  }

  /**
   * Writes `data` to the speaker's Strapi entry and returns the published result.
   * Repairs a missing link on the way: no entry linked yet, or the entry was deleted in
   * Strapi → a new one is created and linked first.
   */
  async function saveToCms(
    speaker: OwnSpeakerRow,
    name: string,
    data: StrapiSpeakerUpdate,
  ): Promise<CmsSpeaker> {
    const { cmsSpeakerId } = speaker;
    if (cmsSpeakerId) {
      const updated = await requireCms("update", () =>
        deps.strapiClient.updateSpeaker(cmsSpeakerId, data),
      );
      if (updated) return updated;
      console.error(
        `[speakers] Strapi speaker ${cmsSpeakerId} is missing; creating a new entry`,
      );
    }

    const created = await requireCms("create", () =>
      deps.strapiClient.createSpeaker({ name }),
    );
    await deps.speakerRepository.setCmsSpeakerId(
      speaker.id,
      created.documentId,
    );
    const updated = await requireCms("update", () =>
      deps.strapiClient.updateSpeaker(created.documentId, data),
    );
    if (!updated) throw cmsUnavailable();
    return updated;
  }

  /** Best effort: a file left behind only takes space in the media library. */
  async function removeUploadedFile(id: number) {
    try {
      await deps.strapiClient.deleteFile(id);
    } catch (error) {
      console.error(
        `[speakers] Strapi file ${id} not deleted:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return {
    /**
     * An organizer (or admin) invites a speaker, in this order:
     * 1. email already used → 409 SPEAKER_EXISTS / EMAIL_TAKEN (before Strapi, so no orphan
     *    entries in the common case)
     * 2. Strapi: empty PUBLISHED Speaker entry → documentId (Strapi down → 503, nothing saved).
     *    Published at once: the speaker is usable and listed even before they ever log in.
     * 3. ONE transaction: user (pending) + speaker role + profile (with documentId) + token
     *    (fails → the Strapi entry is deleted again)
     * 4. after the commit: queue the existing account-setup email
     * The speaker fills bio, photo, links... later, after setting a password.
     * `inviter` is the signed-in user from the access token, never from the request body.
     * An organizer still waiting for admin approval → 403 before anything else happens.
     */
    async createSpeaker(
      input: CreateSpeakerBody,
      inviter: Inviter,
    ): Promise<CreateSpeakerResponseDto> {
      await deps.organizerVerification.assertVerifiedOrganizer(inviter);
      await assertEmailFree(input.email);

      const cmsSpeaker = await createCmsSpeaker(
        `${input.firstName} ${input.lastName}`,
      );
      const setupToken = deps.createAccountSetupToken();

      let result: Awaited<ReturnType<SpeakerRepository["createSpeaker"]>>;
      try {
        result = await deps.speakerRepository.createSpeaker({
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          slug: deps.createSlug(input.firstName, input.lastName),
          cmsSpeakerId: cmsSpeaker.documentId,
          createdBy: inviter.id,
          setupToken: {
            tokenHash: setupToken.tokenHash,
            expiresAt: setupToken.expiresAt,
          },
        });
      } catch (error) {
        await removeCmsSpeaker(cmsSpeaker.documentId);
        throw error;
      }
      if (!result.ok) {
        // Lost a race with another invite for the same email: give the same answer as if
        // that invite had come first (SPEAKER_EXISTS with details, or EMAIL_TAKEN).
        await removeCmsSpeaker(cmsSpeaker.documentId);
        await assertEmailFree(input.email);
        throw emailTaken();
      }

      // Only now, after the commit: a rolled-back account must never get an email.
      // If Redis is down the account still exists; report it instead of failing.
      let setupEmailQueued = true;
      try {
        await deps.enqueueAccountSetupEmail({
          to: result.user.email,
          firstName: result.user.firstName,
          passwordSetupUrl: `${deps.appUrl}/set-password?token=${encodeURIComponent(setupToken.token)}`,
          loginUrl: `${deps.appUrl}/login`,
          expiresInHours: ACCOUNT_SETUP_TOKEN_TTL_HOURS,
        });
      } catch (error) {
        setupEmailQueued = false;
        // Message only: the error could carry the job data, which holds the setup link.
        console.error(
          `[speakers] setup email not queued for user ${result.user.id}:`,
          error instanceof Error ? error.message : error,
        );
      }

      return toSpeakerDto(result.user, result.profile, setupEmailQueued);
    },

    /**
     * ADM-6: a new set-password invite for a speaker who has not set up their account yet.
     * Any organizer or admin may ask (speakers are shared, no organizer owns one); the email
     * only ever goes to the speaker's own inbox, and a cooldown stops spamming it.
     * An organizer still waiting for admin approval → 403.
     */
    async resendInvite(
      slug: string,
      requester: Inviter,
    ): Promise<ResendInviteResponseDto> {
      await deps.organizerVerification.assertVerifiedOrganizer(requester);
      const invitee = await deps.speakerRepository.findInviteeBySlug(slug);
      if (!invitee) throw new NotFoundError("Speaker not found");
      return deps.accountInviteService.resendAccountSetup(invitee.userId);
    },

    /**
     * SPK-1: one page of public speakers. Postgres decides WHO is listed (order, search,
     * total); Strapi only adds the card content, fetched for the whole page in one call.
     */
    async listSpeakers(
      query: ListSpeakersQuery,
    ): Promise<{ items: SpeakerListItemDto[]; meta: PageMeta }> {
      const { page, pageSize } = query;

      const { rows, total } = await deps.speakerRepository.listSpeakers({
        // An empty value after trim counts as no search.
        search: query.search || undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });

      const documentIds = rows.flatMap((row) =>
        row.cmsSpeakerId ? [row.cmsSpeakerId] : [],
      );
      const cmsSpeakers = await withoutCmsOnFailure("speaker list", [], () =>
        deps.strapiClient.findSpeakersByIds(documentIds),
      );
      const cmsById = new Map(cmsSpeakers.map((cms) => [cms.documentId, cms]));

      return {
        items: rows.map((row) =>
          toSpeakerListItemDto(
            row,
            (row.cmsSpeakerId && cmsById.get(row.cmsSpeakerId)) || null,
          ),
        ),
        meta: { page, pageSize, total },
      };
    },

    /** SPK-2: one public speaker profile. Unknown (or suspended) slug → 404. */
    async getSpeakerBySlug(slug: string): Promise<SpeakerProfileDto> {
      const row = await deps.speakerRepository.findBySlug(slug);
      if (!row) throw new NotFoundError("Speaker not found");

      const { cmsSpeakerId } = row;
      const cms = cmsSpeakerId
        ? await withoutCmsOnFailure(`speaker ${cmsSpeakerId}`, null, () =>
            deps.strapiClient.findSpeakerById(cmsSpeakerId),
          )
        : null;

      return toSpeakerProfileDto(row, cms);
    },

    /** The edit form's current values. The speaker comes from the login, never from the URL. */
    async getOwnProfile(userId: string): Promise<OwnSpeakerProfileDto> {
      const speaker = await requireOwnSpeaker(userId);
      return toOwnSpeakerProfileDto(speaker, await loadOwnCms(speaker));
    },

    /**
     * Saves the edit form (only the fields that were sent), in this order:
     * 1. Strapi: content, plus `name` when the name changed (the call most likely to fail;
     *    if it does → 503 and nothing changed anywhere)
     * 2. Postgres: the names
     * No undo needed: this PATCH is idempotent, so if step 2 fails, saving the same form
     * again brings both in line. The slug never changes, so public links keep working.
     */
    async updateOwnProfile(
      userId: string,
      body: UpdateOwnSpeakerProfileBody,
    ): Promise<OwnSpeakerProfileDto> {
      const speaker = await requireOwnSpeaker(userId);

      const names = {
        firstName: body.firstName ?? speaker.firstName,
        lastName: body.lastName ?? speaker.lastName,
      };
      const namesChanged =
        names.firstName !== speaker.firstName ||
        names.lastName !== speaker.lastName;
      const fullName = `${names.firstName} ${names.lastName}`;

      const data = toStrapiUpdate(body);
      if (namesChanged) data.name = fullName;

      const cms =
        Object.keys(data).length > 0
          ? await saveToCms(speaker, fullName, data)
          : await loadOwnCms(speaker);

      if (namesChanged) {
        await deps.speakerRepository.updateNames(userId, names);
      }

      return toOwnSpeakerProfileDto({ ...speaker, ...names }, cms);
    },

    /**
     * Replaces the photo. The upload is streamed straight to Strapi (nothing is stored on
     * this server), so the file is checked on what Strapi reports back:
     * 1. stream to Strapi, cut off past the size limit
     * 2. not one real JPEG/PNG/WebP (type detected from the bytes) → delete it, 400
     * 3. set it as the speaker's photo (fails → delete the new file, 503)
     * 4. delete the old photo (best effort)
     */
    async replaceOwnPhoto(
      userId: string,
      upload: PhotoUpload,
    ): Promise<SpeakerPhotoResponseDto> {
      // Before a single byte goes to Strapi: only speakers may upload.
      const speaker = await requireOwnSpeaker(userId);
      const current = await loadOwnCms(speaker);

      const limit = createByteLimit(SPEAKER_PHOTO_MAX_BODY_BYTES);
      let result: Awaited<ReturnType<StrapiSpeakerClient["uploadFiles"]>>;
      try {
        result = await deps.strapiClient.uploadFiles(
          upload.body.pipeThrough(limit.stream),
          upload.contentType,
        );
      } catch (error) {
        if (limit.exceeded()) throw invalidPhoto();
        console.error(
          "[speakers] photo upload to Strapi failed:",
          error instanceof Error ? error.message : error,
        );
        throw cmsUnavailable();
      }
      // Strapi refused the file itself (e.g. a type its upload settings deny).
      if (!result.ok) throw invalidPhoto();

      const [photo, ...extra] = result.files;
      if (!photo || extra.length > 0 || !isAcceptablePhoto(photo)) {
        await Promise.all(
          result.files.map((file) => removeUploadedFile(file.id)),
        );
        throw invalidPhoto();
      }

      let cms: CmsSpeaker;
      try {
        cms = await saveToCms(
          speaker,
          `${speaker.firstName} ${speaker.lastName}`,
          {
            photo: photo.id,
          },
        );
      } catch (error) {
        await removeUploadedFile(photo.id);
        throw error;
      }

      const oldPhotoId = current?.photo?.id;
      if (oldPhotoId && oldPhotoId !== photo.id) {
        await removeUploadedFile(oldPhotoId);
      }

      const dto = toPhotoDto(speaker, cms.photo);
      if (!dto) {
        throw new Error(
          `Strapi speaker ${cms.documentId} has no photo after setting one`,
        );
      }
      return { photo: dto };
    },
  };
}

/**
 * ERR-4: the CMS being down must not take the speaker pages down. On any failure, log it
 * (message only) and continue with `fallback`, so the page still shows the names from
 * Postgres.
 */
async function withoutCmsOnFailure<T>(
  what: string,
  fallback: T,
  load: () => Promise<T>,
): Promise<T> {
  try {
    return await load();
  } catch (error) {
    console.error(
      `[speakers] CMS content for ${what} not loaded, showing names only:`,
      error instanceof Error ? error.message : error,
    );
    return fallback;
  }
}

export const speakerService = createSpeakerService({
  speakerRepository,
  createAccountSetupToken,
  enqueueAccountSetupEmail,
  accountInviteService,
  strapiClient: strapiSpeakerClient,
  createSlug: createSpeakerSlug,
  appUrl: env.APP_URL,
  organizerVerification: organizerService,
});
