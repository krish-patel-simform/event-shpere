import { z } from "zod";
import {
  LIGHTNING_MAX_MINUTES,
  SESSION_ABSTRACT_MAX,
  SESSION_ABSTRACT_MIN,
  SESSION_DURATIONS,
  SESSION_FORMATS,
  SESSION_LEVELS,
  SESSION_NOTES_MAX,
  SESSION_TAKEAWAY_MAX,
  SESSION_TAKEAWAY_SLOTS,
  SESSION_TITLE_MAX,
  SESSION_TRACKS,
} from "../constants";

const takeawaySchema = z
  .string()
  .trim()
  .max(
    SESSION_TAKEAWAY_MAX,
    `Keep each takeaway under ${SESSION_TAKEAWAY_MAX} characters`,
  );

/** 300-1200 characters; the message says how long the text is now, so the speaker knows how far off. */
const abstractSchema = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    if (value.length < SESSION_ABSTRACT_MIN) {
      ctx.addIssue({
        code: "custom",
        message: `Abstract must be at least ${SESSION_ABSTRACT_MIN} characters (currently ${value.length}).`,
      });
    } else if (value.length > SESSION_ABSTRACT_MAX) {
      ctx.addIssue({
        code: "custom",
        message: `Abstract must be at most ${SESSION_ABSTRACT_MAX} characters (currently ${value.length}).`,
      });
    }
  });

/**
 * The "Submit a session" form. Every field is a string (or a list of strings), as the form gives
 * them, so the same schema types the form and, later, the request body.
 */
export const sessionSubmissionSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Enter a title")
      .max(
        SESSION_TITLE_MAX,
        `Keep the title under ${SESSION_TITLE_MAX} characters`,
      ),
    format: z.enum(SESSION_FORMATS, { error: "Choose a format" }),
    /** Minutes. */
    duration: z.enum(SESSION_DURATIONS, { error: "Choose a duration" }),
    track: z.enum(SESSION_TRACKS, { error: "Choose a track" }),
    level: z.enum(SESSION_LEVELS, { error: "Choose an audience level" }),
    abstract: abstractSchema,
    /** Always SESSION_TAKEAWAY_SLOTS entries; the first is required, empty others are ignored. */
    takeaways: z
      .array(takeawaySchema)
      .length(SESSION_TAKEAWAY_SLOTS)
      .superRefine((value, ctx) => {
        if (value[0] === "") {
          ctx.addIssue({
            code: "custom",
            path: [0],
            message: "Add at least one takeaway",
          });
        }
      }),
    /** One email to invite as co-speaker; empty = none. */
    coSpeakerEmail: z
      .string()
      .trim()
      .refine((value) => value === "" || z.email().safeParse(value).success, {
        error: "Enter a valid email address",
      }),
    /** A link to an outline or an earlier recording; empty = none. */
    materialUrl: z
      .string()
      .trim()
      .refine((value) => value === "" || isWebUrl(value), {
        error: "Enter a link that starts with http:// or https://",
      }),
    /** The event days (ISO dates) the speaker can present on. */
    availability: z
      .array(z.iso.date())
      .min(1, "Pick at least one day you can present"),
    notes: z
      .string()
      .trim()
      .max(
        SESSION_NOTES_MAX,
        `Keep the notes under ${SESSION_NOTES_MAX} characters`,
      ),
  })
  .superRefine((value, ctx) => {
    if (
      value.format === "lightning" &&
      Number(value.duration) > LIGHTNING_MAX_MINUTES
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["duration"],
        message: `A lightning talk is at most ${LIGHTNING_MAX_MINUTES} minutes`,
      });
    }
  });

export type SessionSubmission = z.infer<typeof sessionSubmissionSchema>;

function isWebUrl(value: string): boolean {
  if (!URL.canParse(value)) return false;
  const { protocol } = new URL(value);
  return protocol === "http:" || protocol === "https:";
}
