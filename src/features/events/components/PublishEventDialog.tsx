"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import type { ApiError } from "@/src/core/api-client/base-api.service";
import {
  Alert,
  Button,
  DatePicker,
  Dialog,
  DialogBody,
  DialogFooter,
  TimePicker,
} from "@/src/core/ui";
import {
  createPublishFormSchema,
  emptyPublishFormValues,
  toPublishEventRequest,
  type PublishFormValues,
} from "../schemas/event-publish-form.schemas";
import type { PublishEventRequest } from "../schemas/events.schemas";
import type { ManagedEvent } from "../types/event-manage.types";
import {
  earliestEndTime,
  earliestStartTime,
  eventDateLimits,
  EVENT_TIME_STEP,
} from "../utils/event-date-limits";
import {
  formatEventDates,
  toFormDateTime,
  zoneLabel,
} from "../utils/event-display";

type PublishEventDialogProps = {
  /** The draft to publish; nothing is shown while it is null. */
  event: ManagedEvent | null;
  onClose: () => void;
  /** Called with the dates registration opens and closes, once they pass the form's checks. */
  onSubmit: (body: PublishEventRequest) => void;
  /** The request is running: the fields and buttons show it. */
  isPending?: boolean;
  /** What the server answered when it refused. */
  error?: ApiError | null;
};

/**
 * Publishing makes the event public, so it first asks when registration opens and closes (both
 * are required): from today up to before the event starts. The server checks the same rules; a
 * refusal about one date shows under that date, anything else in the box on top.
 */
export function PublishEventDialog({
  event,
  onClose,
  onSubmit,
  isPending = false,
  error = null,
}: PublishEventDialogProps) {
  return (
    <Dialog open={event !== null} onClose={onClose} title="Publish this event?">
      {/* Mounted only while open: the fields start empty every time. */}
      {event && (
        <PublishForm
          event={event}
          onClose={onClose}
          onSubmit={onSubmit}
          isPending={isPending}
          error={error}
        />
      )}
    </Dialog>
  );
}

/** The later of two "HH:mm" times; null (no time left that day) wins. */
function latestTime(a: string | null, b: string | null): string | null {
  if (a === null || b === null) return null;
  return a > b ? a : b;
}

function PublishForm({
  event,
  onClose,
  onSubmit,
  isPending,
  error,
}: Required<Omit<PublishEventDialogProps, "event">> & {
  event: ManagedEvent;
}) {
  const schema = useMemo(
    () => createPublishFormSchema(event.startAt),
    [event.startAt],
  );
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<PublishFormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyPublishFormValues,
  });

  const [opensDate, opensTime, closesDate] = useWatch({
    control,
    name: ["opensDate", "opensTime", "closesDate"],
  });

  // What the pickers offer: days from today up to the day the event starts. It cannot close
  // before it opens, nor at a time that has already passed today.
  const today = eventDateLimits().min;
  const startDay = toFormDateTime(event.startAt, event.timezone);
  const closesMinDate = opensDate > today ? opensDate : today;
  const closesMinTime = latestTime(
    earliestStartTime(closesDate),
    earliestEndTime(opensDate, opensTime, closesDate),
  );

  const serverError = (field: "registrationOpensAt" | "registrationClosesAt") =>
    error?.fieldErrors[field]?.[0];
  // Anything that is not about one date goes in the box on top.
  const generalError =
    error && Object.keys(error.fieldErrors).length === 0
      ? error.message
      : undefined;

  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) =>
        onSubmit(toPublishEventRequest(values)),
      )}
    >
      <DialogBody>
        {generalError && (
          <Alert tone="error" title="We couldn't publish the event">
            {generalError}
          </Alert>
        )}
        <p>
          <strong>{event.title}</strong> becomes public, and attendees can
          register between the two dates you choose.
        </p>
        <p className="text-sm text-muted">
          All times are in India Standard Time ({zoneLabel(event.timezone)}).
          The event starts on{" "}
          {formatEventDates(event.startAt, event.startAt, event.timezone)} at{" "}
          {startDay.time}, so registration must end before then.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            control={control}
            name="opensDate"
            render={({ field }) => (
              <DatePicker
                label="Registration start date"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                fieldRef={field.ref}
                min={today}
                max={startDay.date}
                disabled={isPending}
                error={
                  errors.opensDate?.message ??
                  serverError("registrationOpensAt")
                }
              />
            )}
          />
          <Controller
            control={control}
            name="opensTime"
            render={({ field }) => (
              <TimePicker
                label="Registration start time"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                fieldRef={field.ref}
                step={EVENT_TIME_STEP}
                disabled={isPending}
                error={errors.opensTime?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="closesDate"
            render={({ field }) => (
              <DatePicker
                label="Registration end date"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                fieldRef={field.ref}
                min={closesMinDate}
                max={startDay.date}
                disabled={isPending}
                error={
                  errors.closesDate?.message ??
                  serverError("registrationClosesAt")
                }
              />
            )}
          />
          <Controller
            control={control}
            name="closesTime"
            render={({ field }) => (
              <TimePicker
                label="Registration end time"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                fieldRef={field.ref}
                min={closesMinTime}
                step={EVENT_TIME_STEP}
                disabled={isPending}
                error={errors.closesTime?.message}
              />
            )}
          />
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" isPending={isPending}>
          {isPending ? "Publishing…" : "Publish event"}
        </Button>
      </DialogFooter>
    </form>
  );
}
