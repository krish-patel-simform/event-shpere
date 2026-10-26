import "server-only";
import type { Speaker, User } from "../../../db/schemas";
import type { CmsSpeaker } from "../../cms";
import type {
  CreateSpeakerResponseDto,
  ExistingSpeakerDto,
  OwnSpeakerProfileDto,
  SpeakerListItemDto,
  SpeakerPhotoResponseDto,
  SpeakerProfileDto,
} from "../schemas/speaker.schemas";
import { blocksToText } from "../utils/bio-blocks";

type SpeakerPhotoDto = SpeakerPhotoResponseDto["photo"];
import type { ExistingSpeakerRow, SpeakerRow } from "./speaker.repository";

// Picks fields one by one: passwordHash, cms_speaker_id, createdBy and other internals never leave.
export function toSpeakerDto(
  user: User,
  profile: Speaker,
  setupEmailQueued: boolean,
): CreateSpeakerResponseDto {
  return {
    id: profile.id,
    userId: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    status: user.status,
    slug: profile.slug,
    createdAt: profile.createdAt.toISOString(),
    setupEmailQueued,
  };
}

// For the 409 SPEAKER_EXISTS details. The row only has these fields, but pick them anyway so
// adding a column to the query never leaks it by accident.
export function toExistingSpeakerDto(
  row: ExistingSpeakerRow,
): ExistingSpeakerDto {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    slug: row.slug,
    status: row.status,
  };
}

/**
 * Links are free text in Strapi. Only http(s) URLs leave the API: a "javascript:" link
 * would run code when clicked. Anything else is dropped (null), not an error.
 */
function safeHttpUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

type SpeakerName = { firstName: string; lastName: string };

/** The photo as every response shows it; the Strapi file id stays internal. */
export function toPhotoDto(
  name: SpeakerName,
  photo: CmsSpeaker["photo"],
): SpeakerPhotoDto | null {
  const url = photo ? safeHttpUrl(photo.url) : null;
  if (!photo || !url) return null;
  return {
    url,
    alt: photo.alt ?? `${name.firstName} ${name.lastName}`,
    width: photo.width,
    height: photo.height,
  };
}

function toSummary(row: SpeakerRow, cms: CmsSpeaker) {
  return {
    photo: toPhotoDto(row, cms.photo),
    jobTitle: cms.jobTitle,
    company: cms.company,
  };
}

// Public: name from Postgres, the rest from the CMS. No email, status or ids.
export function toSpeakerListItemDto(
  row: SpeakerRow,
  cms: CmsSpeaker | null,
): SpeakerListItemDto {
  return {
    slug: row.slug,
    firstName: row.firstName,
    lastName: row.lastName,
    profile: cms ? toSummary(row, cms) : null,
  };
}

export function toSpeakerProfileDto(
  row: SpeakerRow,
  cms: CmsSpeaker | null,
): SpeakerProfileDto {
  return {
    slug: row.slug,
    firstName: row.firstName,
    lastName: row.lastName,
    profile: cms
      ? {
          ...toSummary(row, cms),
          bio: cms.bio,
          expertise: cms.expertise,
          links: {
            linkedin: safeHttpUrl(cms.linkedinUrl),
            twitter: safeHttpUrl(cms.twitterUrl),
            website: safeHttpUrl(cms.websiteUrl),
          },
        }
      : null,
  };
}

/**
 * The edit form's values. Unlike the public profile: bio as plain text for the textarea, and
 * links exactly as stored. `cms` null = no Strapi entry yet, so the form starts empty.
 */
export function toOwnSpeakerProfileDto(
  row: SpeakerRow,
  cms: CmsSpeaker | null,
): OwnSpeakerProfileDto {
  return {
    slug: row.slug,
    firstName: row.firstName,
    lastName: row.lastName,
    jobTitle: cms?.jobTitle ?? null,
    company: cms?.company ?? null,
    bio: cms ? blocksToText(cms.bio) : "",
    expertise: cms?.expertise ?? [],
    linkedinUrl: cms?.linkedinUrl ?? null,
    twitterUrl: cms?.twitterUrl ?? null,
    websiteUrl: cms?.websiteUrl ?? null,
    photo: cms ? toPhotoDto(row, cms.photo) : null,
  };
}
