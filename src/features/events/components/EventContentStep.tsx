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
import { useGetEventContent } from "../hooks/useGetEventContent";
import { useUpdateEventContent } from "../hooks/useUpdateEventContent";
import { eventEditHref } from "../routes";
import { EVENT_CONTENT_LIMITS as LIMITS } from "../schemas/event-content.schemas";
import {
  contentToFormValues,
  eventContentFormSchema,
  toUpdateContentRequest,
  type EventContentFormValues,
} from "../schemas/event-content-form.schemas";

type EventContentStepProps = {
  eventId: string;
  /** Called after the content was saved, and when the organizer skips the step. */
  onContinue: () => void;
};

/**
 * Step 2: the text of the event page, kept in the CMS: tagline, description, venue guide,
 * highlights, FAQs and the search-engine texts. Saving calls PATCH .../content. Nothing here is
 * required to create the event; the description is needed before it is published.
 */
export function EventContentStep({
  eventId,
  onContinue,
}: EventContentStepProps) {
  const content = useGetEventContent(eventId);

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
            notFound ? "Event not found" : "We couldn't load the page content"
          }
        >
          {notFound
            ? "It may have been deleted, or it is not one of your events."
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
      initialValues={contentToFormValues(content.data)}
      onContinue={onContinue}
    />
  );
}

function ContentForm({
  eventId,
  initialValues,
  onContinue,
}: {
  eventId: string;
  initialValues: EventContentFormValues;
  onContinue: () => void;
}) {
  const save = useUpdateEventContent(eventId);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<EventContentFormValues>({
    resolver: zodResolver(eventContentFormSchema),
    defaultValues: initialValues,
  });
  const highlights = useFieldArray({ control, name: "highlights" });
  const faqs = useFieldArray({ control, name: "faqs" });

  const about = useWatch({ control, name: "about" });
  const venueGuide = useWatch({ control, name: "venueGuide" });
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
        title="About the event"
        description="Shown on the public event page. A blank line starts a new paragraph."
      >
        <div className="space-y-4">
          <TextField
            label="Tagline"
            optional
            autoComplete="off"
            readOnly={isPending}
            error={errors.tagline?.message}
            hint="One short line under the title."
            {...register("tagline")}
          />
          <TextAreaField
            label="Description"
            rows={8}
            readOnly={isPending}
            error={errors.about?.message}
            hint={`Needed before the event can be published. ${about.length.toLocaleString("en-IN")} / ${LIMITS.about.toLocaleString("en-IN")}`}
            {...register("about")}
          />
          <TextAreaField
            label="Venue guide"
            rows={4}
            readOnly={isPending}
            error={errors.venueGuide?.message}
            hint={`How to get there, parking, entry. ${venueGuide.length.toLocaleString("en-IN")} / ${LIMITS.venueGuide.toLocaleString("en-IN")}`}
            {...register("venueGuide")}
          />
        </div>
      </Card>

      <Card
        title="Highlights"
        description={`Up to ${LIMITS.highlights} short points that sell the event.`}
        action={
          <Button
            variant="secondary"
            disabled={
              isPending || highlights.fields.length >= LIMITS.highlights
            }
            onClick={() => highlights.append({ title: "", description: "" })}
          >
            <Plus aria-hidden="true" className="size-4" />
            Add highlight
          </Button>
        }
      >
        {highlights.fields.length === 0 ? (
          <p className="text-muted">No highlights yet.</p>
        ) : (
          <ul className="space-y-4">
            {highlights.fields.map((field, index) => (
              <li
                key={field.id}
                className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]"
              >
                <TextField
                  label={`Highlight ${index + 1} title`}
                  autoComplete="off"
                  readOnly={isPending}
                  error={errors.highlights?.[index]?.title?.message}
                  {...register(`highlights.${index}.title`)}
                />
                <TextField
                  label={`Highlight ${index + 1} description`}
                  optional
                  autoComplete="off"
                  readOnly={isPending}
                  error={errors.highlights?.[index]?.description?.message}
                  {...register(`highlights.${index}.description`)}
                />
                <Button
                  variant="secondary"
                  className="sm:mt-6"
                  disabled={isPending}
                  aria-label={`Remove highlight ${index + 1}`}
                  onClick={() => highlights.remove(index)}
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title="FAQs"
        description={`Up to ${LIMITS.faqs} questions attendees often ask.`}
        action={
          <Button
            variant="secondary"
            disabled={isPending || faqs.fields.length >= LIMITS.faqs}
            onClick={() => faqs.append({ question: "", answer: "" })}
          >
            <Plus aria-hidden="true" className="size-4" />
            Add question
          </Button>
        }
      >
        {faqs.fields.length === 0 ? (
          <p className="text-muted">No questions yet.</p>
        ) : (
          <ul className="space-y-5">
            {faqs.fields.map((field, index) => (
              <li key={field.id} className="space-y-3">
                <div className="flex items-start gap-3">
                  <TextField
                    className="min-w-0 flex-1"
                    label={`Question ${index + 1}`}
                    autoComplete="off"
                    readOnly={isPending}
                    error={errors.faqs?.[index]?.question?.message}
                    {...register(`faqs.${index}.question`)}
                  />
                  <Button
                    variant="secondary"
                    className="mt-6"
                    disabled={isPending}
                    aria-label={`Remove question ${index + 1}`}
                    onClick={() => faqs.remove(index)}
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                  </Button>
                </div>
                <TextAreaField
                  label={`Answer ${index + 1}`}
                  rows={3}
                  readOnly={isPending}
                  error={errors.faqs?.[index]?.answer?.message}
                  {...register(`faqs.${index}.answer`)}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title="Search appearance"
        description="How the event page looks in search results. Leave empty to use the title."
      >
        <div className="space-y-4">
          <TextField
            label="Meta title"
            optional
            autoComplete="off"
            readOnly={isPending}
            error={errors.seo?.metaTitle?.message}
            hint={`Up to ${LIMITS.metaTitle} characters.`}
            {...register("seo.metaTitle")}
          />
          <TextAreaField
            label="Meta description"
            rows={2}
            readOnly={isPending}
            error={errors.seo?.metaDescription?.message}
            hint={`Up to ${LIMITS.metaDescription} characters.`}
            {...register("seo.metaDescription")}
          />
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={eventEditHref(eventId, "details")}
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
