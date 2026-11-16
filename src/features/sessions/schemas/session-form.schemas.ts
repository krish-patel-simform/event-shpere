import { z } from "zod";
import {
  sessionModeEnum,
  sessionTypeEnum,
  type SessionStatus,
} from "../../../db/schemas";
import {
  istInstant,
  rupeesToPaise,
  toFormDateTime,
  toIsoWithOffset,
} from "../../events";
import { checkSessionShape } from "../utils/session-rules";
import {
  sessionSpeakersSchema,
  type CreateSessionRequest,
  type SessionDto,
  type UpdateSessionRequest,
} from "./sessions.schemas";

// The form keeps every input as text (an empty price box is "", not NaN), and a session is one
// date with a start and an end time. These rules give messages for the person filling the form.
// An event's times are typed and shown in its own zone (India for now), like the event form.

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;

type SessionType = (typeof sessionTypeEnum.enumValues)[number];
type SessionMode = (typeof sessionModeEnum.enumValues)[number];

// The value stays a plain string (an unchosen select is ""); typeOf / modeOf narrow it on the way out.
const oneOf = (values: readonly string[], message: string) =>
  z.string().refine((value) => values.includes(value), message);

const sessionFormFields = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters")
    .max(255, "Title must be 255 characters or fewer"),
  /** "" = not chosen yet. */
  type: oneOf(sessionTypeEnum.enumValues, "Choose a session type"),
  mode: oneOf(sessionModeEnum.enumValues, "Choose how the session is attended"),
  /** "" = no hall (an online session). */
  hallId: z.string().trim(),
  /** "" = no join link (an in-person session). */
  onlineUrl: z
    .string()
    .trim()
    .refine(
      (value) =>
        value === "" || z.url({ protocol: /^https$/ }).safeParse(value).success,
      "Use a link that starts with https://",
    ),
  date: z.string().trim().regex(DATE_PATTERN, "Date is required"),
  startTime: z.string().trim().regex(TIME_PATTERN, "Start time is required"),
  endTime: z.string().trim().regex(TIME_PATTERN, "End time is required"),
  requiresRegistration: z.boolean(),
  /** In rupees; 0 = included in the event ticket. */
  price: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "Enter an amount like 0 or 499.50"),
});

export type SessionFormValues = z.infer<typeof sessionFormFields>;

/**
 * The rules that need several fields at once: the hall and the link must fit the mode, and the end
 * must be after the start. The same function the server runs on the merged session, so the form
 * and the API never disagree. A time that is missing or malformed already has its own message,
 * so it is not reported twice.
 */
function checkForm(values: SessionFormValues, ctx: z.RefinementCtx) {
  const startAt = istInstant(values.date, values.startTime);
  const endAt = istInstant(values.date, values.endTime);

  for (const found of checkSessionShape({
    mode: modeOf(values.mode),
    hallId: values.hallId || null,
    onlineUrl: values.onlineUrl || null,
    startAt,
    endAt,
  })) {
    if (found.path === "startAt" && !startAt) continue;
    if (found.path === "endAt" && !endAt) continue;
    ctx.addIssue({
      code: "custom",
      // The form's fields are the date and two times, not the instants the API takes.
      path: [
        found.path === "startAt"
          ? "startTime"
          : found.path === "endAt"
            ? "endTime"
            : found.path,
      ],
      message: found.message,
    });
  }
}

/** A mode the form has not got yet is checked by its own field; here it only has to type-check. */
function modeOf(value: string): SessionMode {
  return (
    sessionModeEnum.enumValues.find((mode) => mode === value) ?? "in_person"
  );
}

/** The details of a session (what the edit form holds). */
export const sessionFormSchema = sessionFormFields.superRefine(checkForm);

/** A new session: its details and who presents it, saved together (the API takes them in one request). */
export const createSessionFormSchema = sessionFormFields
  .extend({ speakers: sessionSpeakersSchema })
  .superRefine(checkForm);

export type CreateSessionFormValues = z.input<typeof createSessionFormSchema>;

/** A new session: in person, 09:00-10:00, included in the ticket, nothing chosen yet. */
export const emptySessionForm: SessionFormValues = {
  title: "",
  type: "",
  mode: "in_person",
  hallId: "",
  onlineUrl: "",
  date: "",
  startTime: "09:00",
  endTime: "10:00",
  requiresRegistration: false,
  price: "",
};

/** One saved session as the edit form's inputs: the date and times in the event's own zone. */
export function sessionToFormValues(
  session: Pick<
    SessionDto,
    | "title"
    | "type"
    | "mode"
    | "hallId"
    | "onlineUrl"
    | "startAt"
    | "endAt"
    | "requiresRegistration"
    | "price"
  >,
  timezone: string,
): SessionFormValues {
  const start = session.startAt
    ? toFormDateTime(session.startAt, timezone)
    : { date: "", time: "" };
  const end = session.endAt
    ? toFormDateTime(session.endAt, timezone)
    : { date: "", time: "" };

  return {
    title: session.title,
    type: session.type,
    mode: session.mode,
    hallId: session.hallId ?? "",
    onlineUrl: session.onlineUrl ?? "",
    date: start.date,
    startTime: start.time,
    endTime: end.time,
    requiresRegistration: session.requiresRegistration,
    price: String(session.price / 100),
  };
}

//* From the form's text to what the API takes

function typeOf(value: string): SessionType {
  const type = sessionTypeEnum.enumValues.find((item) => item === value);
  if (!type) throw new Error(`"${value}" is not a session type`);
  return type;
}

/**
 * The body of POST /api/events/[id]/sessions. An empty hall or link is left out (not sent as ""),
 * and the times carry the event's zone offset, as the API asks.
 */
export function toCreateSessionRequest(
  values: SessionFormValues,
  speakers: CreateSessionRequest["speakers"],
): CreateSessionRequest {
  return {
    title: values.title,
    type: typeOf(values.type),
    mode: modeOf(values.mode),
    ...(values.hallId ? { hallId: values.hallId } : {}),
    ...(values.onlineUrl ? { onlineUrl: values.onlineUrl } : {}),
    startAt: toIsoWithOffset(values.date, values.startTime),
    endAt: toIsoWithOffset(values.date, values.endTime),
    requiresRegistration: values.requiresRegistration,
    price: rupeesToPaise(values.price),
    speakers,
  };
}

/**
 * The body of PATCH /api/events/[id]/sessions/[id]: every field the form edits. An empty hall or
 * link is sent as null, which clears it (leaving it out would leave the old one): switching a
 * session to online has to say "no hall" itself.
 */
export function toUpdateSessionRequest(
  values: SessionFormValues,
): UpdateSessionRequest {
  return {
    title: values.title,
    type: typeOf(values.type),
    mode: modeOf(values.mode),
    hallId: values.hallId || null,
    onlineUrl: values.onlineUrl || null,
    startAt: toIsoWithOffset(values.date, values.startTime),
    endAt: toIsoWithOffset(values.date, values.endTime),
    requiresRegistration: values.requiresRegistration,
    price: rupeesToPaise(values.price),
  };
}

/** Which statuses a session can show. Cancelled is final; the other two can still be edited. */
export const isSessionEditable = (status: SessionStatus) =>
  status !== "cancelled";
