import type { OwnSpeakerProfileDto } from "../schemas/speaker.schemas";

/**
 * Sample values for the "Edit my profile" form, until GET /api/me/speaker-profile is wired to
 * it. The same shape the real endpoint answers with. No photo, so the form shows initials.
 */
export const OWN_SPEAKER_PROFILE_SAMPLE: OwnSpeakerProfileDto = {
  slug: "ananya-rao-3f9a1c",
  firstName: "Ananya",
  lastName: "Rao",
  jobTitle: "Principal Frontend Engineer",
  company: "Northwind Labs",
  bio: "Ananya leads frontend platform work for a team of 40 engineers, focusing on performance, design systems and developer experience.\n\nThey have spoken at community meetups and conferences on Next.js, TypeScript and state management.",
  expertise: ["Next.js", "TypeScript", "Web performance", "Design systems"],
  linkedinUrl: null,
  twitterUrl: null,
  websiteUrl: null,
  photo: null,
};
