import { z } from "zod";
import { userStatusEnum } from "../../../db/schemas";
import { emailSchema } from "../../auth";

//* POST /api/speakers: an organizer (or admin) invites a speaker.
// No slug, status or createdBy here: the server sets them, never the client.
export const createSpeakerBodySchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  email: emailSchema,
});
export type CreateSpeakerBody = z.infer<typeof createSpeakerBodySchema>;

export const createSpeakerResponseSchema = z.object({
  /** speaker_profiles.id */
  id: z.uuid(),
  userId: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.email(),
  /** `pending` until the speaker sets a password from the email. */
  status: z.enum(userStatusEnum.enumValues),
  /** Public profile URL part, e.g. "ankit-sharma-3f9a1c". */
  slug: z.string(),
  createdAt: z.iso.datetime(),
  /** False if the account was created but the setup email could not be queued. */
  setupEmailQueued: z.boolean(),
});
export type CreateSpeakerResponseDto = z.infer<
  typeof createSpeakerResponseSchema
>;
