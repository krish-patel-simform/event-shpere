import { z } from "zod";

//* POST {STRAPI_URL}/api/speakers?status=draft (server to server, Strapi REST content API)

/** What we send when the speaker is invited: only the name; the speaker fills the rest later. */
export const strapiCreateSpeakerRequestSchema = z.object({
  name: z.string().min(1),
});
export type StrapiCreateSpeakerRequest = z.infer<
  typeof strapiCreateSpeakerRequestSchema
>;

/** What Strapi answers. Only the fields we use are parsed; the rest is ignored. */
export const strapiCreateSpeakerResponseSchema = z.object({
  data: z.object({
    /** Strapi 5 document id (a string): saved in speaker_profiles.cms_speaker_id. */
    documentId: z.string().min(1),
  }),
});
export type StrapiCreatedSpeaker = z.infer<
  typeof strapiCreateSpeakerResponseSchema
>["data"];
