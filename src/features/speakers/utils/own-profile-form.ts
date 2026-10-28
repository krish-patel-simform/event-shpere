import { SPEAKER_PHOTO_MAX_BYTES, SPEAKER_PHOTO_TYPES } from "../constants";
import type {
  OwnSpeakerProfileDto,
  UpdateOwnSpeakerProfileInput,
} from "../schemas/speaker.schemas";

// Small pure helpers of the "Edit my profile" form.

/** Longest bio the form takes (the same as updateOwnSpeakerProfileBodySchema). */
export const BIO_MAX_LENGTH = 5000;
export const TOPICS_MAX = 10;
export const TOPIC_MAX_LENGTH = 40;

/** What the form holds: every field has a value, so the inputs are always controlled. */
export type ProfileFormValues = Required<{
  [K in keyof UpdateOwnSpeakerProfileInput]: NonNullable<
    UpdateOwnSpeakerProfileInput[K]
  >;
}>;

/** The saved profile as form values: a missing (null) text becomes "". */
export function toFormValues(profile: OwnSpeakerProfileDto): ProfileFormValues {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    jobTitle: profile.jobTitle ?? "",
    company: profile.company ?? "",
    bio: profile.bio,
    expertise: profile.expertise,
    linkedinUrl: profile.linkedinUrl ?? "",
    twitterUrl: profile.twitterUrl ?? "",
    websiteUrl: profile.websiteUrl ?? "",
  };
}

/** Form values read while the form is edited (any field may be missing or null) with blanks filled in. */
export function fillValues(
  values: UpdateOwnSpeakerProfileInput,
): ProfileFormValues {
  return {
    firstName: values.firstName ?? "",
    lastName: values.lastName ?? "",
    jobTitle: values.jobTitle ?? "",
    company: values.company ?? "",
    bio: values.bio ?? "",
    expertise: values.expertise ?? [],
    linkedinUrl: values.linkedinUrl ?? "",
    twitterUrl: values.twitterUrl ?? "",
    websiteUrl: values.websiteUrl ?? "",
  };
}

/**
 * The schema's default messages for a too long text ("Too big: expected string to have <=100
 * characters") are not for people. Keeps our own messages as they are.
 */
export function friendlyError(
  message: string | undefined,
  maxLength: number,
): string | undefined {
  if (!message) return undefined;
  return /^too big/i.test(message)
    ? `Use at most ${maxLength} characters`
    : message;
}

/** What a link field says when its text is not a web address. */
export const LINK_ERROR =
  "Enter a full web address that starts with http:// or https://";

/** Link errors: a too long address keeps the length message, anything else is "not a web address". */
export function linkError(message: string | undefined): string | undefined {
  if (!message) return undefined;
  return /^too big/i.test(message) ? friendlyError(message, 255) : LINK_ERROR;
}

/**
 * Why a chosen file cannot be the photo, or undefined when it can. The server checks the same
 * rules (and the real bytes) again: this only saves the speaker a round trip.
 */
export function photoFileError(
  file: Pick<File, "type" | "size">,
): string | undefined {
  if (!(SPEAKER_PHOTO_TYPES as readonly string[]).includes(file.type)) {
    return "Choose a JPG, PNG or WebP image";
  }
  if (file.size > SPEAKER_PHOTO_MAX_BYTES) {
    return `The photo must be ${SPEAKER_PHOTO_MAX_BYTES / (1024 * 1024)} MB or smaller`;
  }
  return undefined;
}

export type Completeness = {
  /** Whole percent of the checks that pass. */
  percent: number;
  /** What is still missing, as short phrases ("a job title"). */
  missing: string[];
};

/** How complete the public profile is: job title, company, bio, a topic and a link. */
export function profileCompleteness(
  values: Pick<
    ProfileFormValues,
    | "jobTitle"
    | "company"
    | "bio"
    | "expertise"
    | "linkedinUrl"
    | "twitterUrl"
    | "websiteUrl"
  >,
): Completeness {
  const checks: [string, boolean][] = [
    ["a job title", values.jobTitle.trim() !== ""],
    ["a company", values.company.trim() !== ""],
    ["a bio", values.bio.trim() !== ""],
    ["at least one topic", values.expertise.length > 0],
    [
      "at least one link",
      [values.linkedinUrl, values.twitterUrl, values.websiteUrl].some(
        (link) => link.trim() !== "",
      ),
    ],
  ];
  return {
    percent: Math.round(
      (checks.filter(([, done]) => done).length / checks.length) * 100,
    ),
    missing: checks.filter(([, done]) => !done).map(([label]) => label),
  };
}
