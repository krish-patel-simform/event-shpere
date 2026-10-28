"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import {
  Alert,
  Button,
  buttonStyles,
  FormSection,
  TextAreaField,
  TextField,
} from "@/src/core/ui";
import {
  SESSION_ABSTRACT_MAX,
  SESSION_ABSTRACT_MIN,
  SESSION_DURATIONS,
  SESSION_FORMAT_LABELS,
  SESSION_FORMATS,
  SESSION_LEVEL_LABELS,
  SESSION_LEVELS,
  SESSION_NOTES_MAX,
  SESSION_TAKEAWAY_SLOTS,
  SESSION_TITLE_MAX,
  SESSION_TRACK_LABELS,
  SESSION_TRACKS,
} from "../constants";
import { SESSION_ROUTES } from "../routes";
import {
  sessionSubmissionSchema,
  type SessionSubmission,
} from "../schemas/session-submission.schema";
import { formatDayShort } from "../utils/session-display";
import { SAMPLE_SUBMISSION_CALL } from "../utils/sessions.sample";
import { SelectField } from "./SelectField";

type SessionSubmissionFormProps = {
  /**
   * Called with the checked values when the speaker submits. The default does nothing: the form
   * then says that nothing was sent anywhere. The API call will be passed in here.
   */
  onSubmit?: (values: SessionSubmission) => void | Promise<void>;
  /** Called when the speaker saves a draft (only the title is checked). Same default. */
  onSaveDraft?: (values: SessionSubmission) => void | Promise<void>;
  /** The event days (ISO dates) to offer under Availability. */
  days?: readonly string[];
};

type Outcome = "submitted" | "draft" | "failed";

const choiceCard =
  "flex flex-1 basis-36 cursor-pointer items-center gap-2.5 rounded-md border border-field px-3.5 py-2.5 text-sm has-checked:border-brand has-checked:bg-brand-soft has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-link";

/**
 * The "Submit a session" form: details, content, availability. React Hook Form + the Zod schema,
 * with inline errors and a pending button. Nothing is sent to a server (there is none yet): a
 * valid submit calls `onSubmit` and then shows a note saying so.
 */
export function SessionSubmissionForm({
  onSubmit = () => undefined,
  onSaveDraft = () => undefined,
  days = SAMPLE_SUBMISSION_CALL.days,
}: SessionSubmissionFormProps) {
  const {
    register,
    handleSubmit,
    control,
    trigger,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<SessionSubmission>({
    resolver: zodResolver(sessionSubmissionSchema),
    defaultValues: {
      title: "",
      format: "talk",
      duration: "30",
      level: "intermediate",
      abstract: "",
      takeaways: Array.from({ length: SESSION_TAKEAWAY_SLOTS }, () => ""),
      coSpeakerEmail: "",
      materialUrl: "",
      availability: [],
      notes: "",
    },
  });

  const title = useWatch({ control, name: "title" });
  const abstract = useWatch({ control, name: "abstract" });
  const notes = useWatch({ control, name: "notes" });

  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const outcomeBox = useRef<HTMLDivElement>(null);
  // Move keyboard focus to the message, so a screen reader reads it and the keyboard is there.
  useEffect(() => {
    if (outcome) outcomeBox.current?.focus();
  }, [outcome]);

  /** Runs the action; the message under the title says how it went. */
  async function run(
    action: (values: SessionSubmission) => void | Promise<void>,
    values: SessionSubmission,
    done: Outcome,
  ) {
    setOutcome(null);
    try {
      await action(values);
      setOutcome(done);
    } catch {
      setOutcome("failed");
    }
  }

  const submit = handleSubmit((values) => run(onSubmit, values, "submitted"));

  async function saveDraft() {
    setOutcome(null);
    // A draft only needs a title: the rest can be finished later.
    if (await trigger("title")) await run(onSaveDraft, getValues(), "draft");
  }

  return (
    <form
      noValidate
      onSubmit={submit}
      aria-label="Submit a session"
      className="overflow-hidden rounded-lg border border-line bg-surface"
    >
      <div className="space-y-8 p-5 sm:p-6">
        {outcome === "failed" && (
          <Alert
            ref={outcomeBox}
            tone="error"
            title="We couldn't send your session"
          >
            Something went wrong. Your answers are still here: try again.
          </Alert>
        )}
        {(outcome === "submitted" || outcome === "draft") && (
          <Alert
            ref={outcomeBox}
            tone="success"
            title="Sample data: nothing was sent to the server"
          >
            {outcome === "submitted"
              ? "Your answers passed the checks, but the session was not submitted for review. That works once the sessions API exists."
              : "Your draft was not saved anywhere. Drafts work once the sessions API exists."}{" "}
            <Link
              href={SESSION_ROUTES.list}
              className="font-semibold text-link underline"
            >
              Back to my sessions
            </Link>
          </Alert>
        )}

        <FormSection title="Session details">
          <TextField
            label="Session title"
            autoComplete="off"
            hint={`Keep it under ${SESSION_TITLE_MAX} characters. ${title.length} / ${SESSION_TITLE_MAX}`}
            error={errors.title?.message}
            readOnly={isSubmitting}
            {...register("title")}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectField
              label="Format"
              error={errors.format?.message}
              disabled={isSubmitting}
              {...register("format")}
            >
              {SESSION_FORMATS.map((format) => (
                <option key={format} value={format}>
                  {SESSION_FORMAT_LABELS[format]}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Duration"
              error={errors.duration?.message}
              disabled={isSubmitting}
              {...register("duration")}
            >
              {SESSION_DURATIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} minutes
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Track"
              error={errors.track?.message}
              disabled={isSubmitting}
              defaultValue=""
              {...register("track")}
            >
              <option value="" disabled>
                Select a track
              </option>
              {SESSION_TRACKS.map((track) => (
                <option key={track} value={track}>
                  {SESSION_TRACK_LABELS[track]}
                </option>
              ))}
            </SelectField>
          </div>
          <fieldset
            aria-describedby={errors.level ? "level-error" : undefined}
            className="min-w-0"
          >
            <legend className="mb-1.5 text-sm font-semibold">
              Audience level
            </legend>
            <div className="flex flex-wrap gap-2.5">
              {SESSION_LEVELS.map((level) => (
                <label key={level} className={choiceCard}>
                  <input
                    type="radio"
                    value={level}
                    disabled={isSubmitting}
                    className="size-4"
                    {...register("level")}
                  />
                  {SESSION_LEVEL_LABELS[level]}
                </label>
              ))}
            </div>
            {errors.level && (
              <p id="level-error" className="mt-1.5 text-sm text-danger">
                {errors.level.message}
              </p>
            )}
          </fieldset>
        </FormSection>

        <FormSection title="Content">
          <TextAreaField
            label="Abstract"
            rows={6}
            hint={`${SESSION_ABSTRACT_MIN}–${SESSION_ABSTRACT_MAX} characters, written for attendees. ${abstract.length} / ${SESSION_ABSTRACT_MAX}`}
            error={errors.abstract?.message}
            readOnly={isSubmitting}
            {...register("abstract")}
          />
          <fieldset className="min-w-0 space-y-2">
            <legend className="mb-1.5 text-sm font-semibold">
              Key takeaways
            </legend>
            {Array.from({ length: SESSION_TAKEAWAY_SLOTS }, (_, index) => (
              <TextField
                key={index}
                label={`Takeaway ${index + 1}`}
                optional={index > 0}
                autoComplete="off"
                error={errors.takeaways?.[index]?.message}
                readOnly={isSubmitting}
                {...register(`takeaways.${index}`)}
              />
            ))}
          </fieldset>
          <TextField
            label="Co-speaker email"
            optional
            type="email"
            autoComplete="off"
            placeholder="name@company.com"
            hint="Invitations are not sent yet. Once they are, a co-speaker must verify their email before the session is reviewed."
            error={errors.coSpeakerEmail?.message}
            readOnly={isSubmitting}
            {...register("coSpeakerEmail")}
          />
          <TextField
            label="Link to an outline or earlier recording"
            optional
            inputMode="url"
            autoComplete="off"
            placeholder="https://"
            hint="File upload is not available yet, so share a link instead."
            error={errors.materialUrl?.message}
            readOnly={isSubmitting}
            {...register("materialUrl")}
          />
        </FormSection>

        <FormSection title="Availability">
          <fieldset
            aria-describedby={
              errors.availability ? "availability-error" : undefined
            }
            className="min-w-0"
          >
            <legend className="mb-1.5 text-sm font-semibold">
              Days you can present
            </legend>
            <div className="flex flex-wrap gap-2.5">
              {days.map((day) => (
                <label key={day} className={choiceCard}>
                  <input
                    type="checkbox"
                    value={day}
                    disabled={isSubmitting}
                    className="size-4"
                    {...register("availability")}
                  />
                  {formatDayShort(`${day}T00:00:00.000Z`)}
                </label>
              ))}
            </div>
            {errors.availability && (
              <p id="availability-error" className="mt-1.5 text-sm text-danger">
                {errors.availability.message}
              </p>
            )}
          </fieldset>
          <TextAreaField
            label="Notes for organizers (optional)"
            rows={3}
            placeholder="Accessibility needs, AV requirements, scheduling constraints"
            hint={`${notes.length} / ${SESSION_NOTES_MAX}`}
            error={errors.notes?.message}
            readOnly={isSubmitting}
            {...register("notes")}
          />
        </FormSection>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-subtle px-5 py-4 sm:px-6">
        <Link
          href={SESSION_ROUTES.list}
          className={buttonStyles({ variant: "secondary" })}
        >
          Cancel
        </Link>
        <div className="flex flex-wrap gap-2.5">
          <Button
            variant="secondary"
            disabled={isSubmitting}
            onClick={() => void saveDraft()}
          >
            Save as draft
          </Button>
          <Button type="submit" isPending={isSubmitting}>
            {isSubmitting ? "Submitting…" : "Submit for review"}
          </Button>
        </div>
      </div>
    </form>
  );
}
