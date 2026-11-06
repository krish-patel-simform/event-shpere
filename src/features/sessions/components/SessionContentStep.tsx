"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { ApiError } from "@/src/core/api-client/base-api.service";
import {
  Alert,
  Button,
  buttonStyles,
  Card,
  TextAreaField,
  TextField,
} from "@/src/core/ui";
import { useGetSessionContent } from "../hooks/useGetSessionContent";
import { useUpdateSessionContent } from "../hooks/useUpdateSessionContent";
import { SESSION_CONTENT_LIMITS as LIMITS } from "../schemas/session-content.schemas";
import {
  contentToFormValues,
  sessionContentFormSchema,
  toUpdateContentRequest,
  type SessionContentFormValues,
} from "../schemas/session-content-form.schemas";

type SessionContentStepProps = {
  eventId: string;
  sessionId: string;
  /** Where "Back" goes: the speakers step. */
  backHref: string;
  /** Called after the content was saved, and when the organizer skips the step. */
  onContinue: () => void;
};

/**
 * Step 3: the text of the session page, kept in the CMS: description, prerequisites and useful
 * links. Saving calls PATCH .../content. Nothing here is required: a session is on the schedule
 * without it.
 */
export function SessionContentStep({
  eventId,
  sessionId,
  backHref,
  onContinue,
}: SessionContentStepProps) {
  const content = useGetSessionContent(eventId, sessionId);

  if (content.isPending) {
    return (
      <div
        role="status"
        aria-label="Loading content"
        className="animate-pulse space-y-4 motion-reduce:animate-none"
      >
        <div className="h-56 rounded-lg bg-surface-subtle" />
        <div className="h-32 rounded-lg bg-surface-subtle" />
      </div>
    );
  }

  if (content.isError) {
    const notFound =
      content.error instanceof ApiError && content.error.status === 404;
    return (
      <div className="space-y-4">
        <Alert
          tone="error"
          title={
            notFound ? "Session not found" : "We couldn't load the content"
          }
        >
          {notFound
            ? "It may have been removed, or it is not in one of your events."
            : content.error.message}
        </Alert>
        <div className="flex flex-wrap gap-2.5">
          {!notFound && (
            <Button variant="secondary" onClick={() => void content.refetch()}>
              Try again
            </Button>
          )}
          {/* The content can be written later: the next step does not need it. */}
          <Button variant="secondary" onClick={onContinue}>
            Skip for now
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ContentForm
      eventId={eventId}
      sessionId={sessionId}
      backHref={backHref}
      initialValues={contentToFormValues(content.data)}
      onContinue={onContinue}
    />
  );
}

function ContentForm({
  eventId,
  sessionId,
  backHref,
  initialValues,
  onContinue,
}: SessionContentStepProps & { initialValues: SessionContentFormValues }) {
  const save = useUpdateSessionContent(eventId, sessionId);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<SessionContentFormValues>({
    resolver: zodResolver(sessionContentFormSchema),
    defaultValues: initialValues,
  });
  const resources = useFieldArray({ control, name: "resources" });

  const description = useWatch({ control, name: "description" });
  const prerequisites = useWatch({ control, name: "prerequisites" });
  const isPending = save.isPending;

  // After a failed save, move keyboard focus to the message.
  const errorBox = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (save.error) errorBox.current?.focus();
  }, [save.error]);

  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={handleSubmit((values) =>
        save.mutate(toUpdateContentRequest(values), { onSuccess: onContinue }),
      )}
    >
      {save.error && (
        <Alert ref={errorBox} tone="error" title="We couldn't save the content">
          {save.error.message}
        </Alert>
      )}

      <Card
        title="About the session"
        description="Shown on the public session page. A blank line starts a new paragraph."
      >
        <div className="space-y-4">
          <TextAreaField
            label="Description"
            rows={8}
            readOnly={isPending}
            error={errors.description?.message}
            hint={`${description.length.toLocaleString("en-IN")} / ${LIMITS.description.toLocaleString("en-IN")}`}
            {...register("description")}
          />
          <TextAreaField
            label="Prerequisites"
            rows={3}
            readOnly={isPending}
            error={errors.prerequisites?.message}
            hint={`What attendees should know or bring. ${prerequisites.length.toLocaleString("en-IN")} / ${LIMITS.prerequisites.toLocaleString("en-IN")}`}
            {...register("prerequisites")}
          />
        </div>
      </Card>

      <Card
        title="Useful links"
        description={`Slides, repositories or reading, up to ${LIMITS.resources} links. Links start with https://.`}
        action={
          <Button
            variant="secondary"
            disabled={isPending || resources.fields.length >= LIMITS.resources}
            onClick={() => resources.append({ label: "", url: "" })}
          >
            <Plus aria-hidden="true" className="size-4" />
            Add link
          </Button>
        }
      >
        {resources.fields.length === 0 ? (
          <p className="text-muted">No links yet.</p>
        ) : (
          <ul className="space-y-4">
            {resources.fields.map((field, index) => (
              <li
                key={field.id}
                className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]"
              >
                <TextField
                  label={`Link ${index + 1} label`}
                  autoComplete="off"
                  readOnly={isPending}
                  error={errors.resources?.[index]?.label?.message}
                  {...register(`resources.${index}.label`)}
                />
                <TextField
                  label={`Link ${index + 1} address`}
                  type="url"
                  autoComplete="off"
                  placeholder="https://"
                  readOnly={isPending}
                  error={errors.resources?.[index]?.url?.message}
                  {...register(`resources.${index}.url`)}
                />
                <Button
                  variant="secondary"
                  className="sm:mt-6"
                  disabled={isPending}
                  aria-label={`Remove link ${index + 1}`}
                  onClick={() => resources.remove(index)}
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={backHref}
          className={buttonStyles({ variant: "secondary" })}
        >
          Back
        </Link>
        <div className="flex flex-wrap gap-2.5">
          <Button variant="secondary" disabled={isPending} onClick={onContinue}>
            Skip for now
          </Button>
          <Button type="submit" isPending={isPending}>
            {isPending ? "Saving…" : "Save & continue"}
          </Button>
        </div>
      </div>
    </form>
  );
}
