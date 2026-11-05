"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useMemo, useRef, useState, useEffect } from "react";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { Alert, Breadcrumb, Button, buttonStyles, Card } from "@/src/core/ui";
import {
  EventLoader,
  eventHref,
  eventSessionsHref,
  EVENT_ROUTES,
  isEventEditable,
  toFormDateTime,
  type EventOverviewData,
} from "../../events";
import { useCreateSession } from "../hooks/useCreateSession";
import {
  createSessionFormSchema,
  emptySessionForm,
  toCreateSessionRequest,
  type CreateSessionFormValues,
} from "../schemas/session-form.schemas";
import { SessionDetailsFields } from "./SessionDetailsFields";
import { SpeakerPicker } from "./SpeakerPicker";

/**
 * The page that adds a session to an event: its details and who presents it, saved together (one
 * request, so a session never exists without a speaker). Loads the event first (its dates limit
 * the date, its venue gives the halls). A new session is on the schedule at once; its content and
 * cover image come after, in the edit steps.
 */
export function AddSession({ eventId }: { eventId: string }) {
  return (
    <EventLoader eventId={eventId}>
      {(overview) => <AddSessionPage overview={overview} />}
    </EventLoader>
  );
}

function AddSessionPage({ overview }: { overview: EventOverviewData }) {
  const { event } = overview;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="space-y-3">
        <Breadcrumb
          items={[
            { label: "My events", href: EVENT_ROUTES.list },
            { label: event.title, href: eventHref(event.id) },
            { label: "Sessions", href: eventSessionsHref(event.id) },
            { label: "New session" },
          ]}
        />
        <div>
          <h1 className="text-2xl font-semibold">Add session</h1>
          <p className="text-muted">{event.title}</p>
        </div>
      </header>

      {isEventEditable(event.status) ? (
        <AddSessionForm event={event} />
      ) : (
        <div className="space-y-4">
          <Alert tone="info" title="Sessions are read-only">
            {event.status === "cancelled"
              ? "This event is cancelled, so no session can be added."
              : "This event has ended, so no session can be added."}
          </Alert>
          <Link
            href={eventSessionsHref(event.id)}
            className={buttonStyles({ variant: "secondary" })}
          >
            Back to sessions
          </Link>
        </div>
      )}
    </div>
  );
}

function AddSessionForm({ event }: { event: EventOverviewData["event"] }) {
  const router = useRouter();
  const create = useCreateSession(event.id);

  // Leaving the page hides it (React <Activity>) instead of unmounting it, so the form would
  // still be filled in when the organizer comes back. A new key mounts it empty again.
  const [formKey, setFormKey] = useState(0);
  useLayoutEffect(
    () => () => {
      create.reset();
      setFormKey((key) => key + 1);
    },
    // `create.reset` is stable; this must run only when the page is hidden.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <SessionForm
      key={formKey}
      event={event}
      isPending={create.isPending}
      error={create.error?.message}
      onSubmit={(values) =>
        create.mutate(toCreateSessionRequest(values, values.speakers), {
          // The session exists now (and the list and the event's counts were refreshed by the
          // hook): back to the list, replacing this page so Back does not return to the form.
          onSuccess: () => router.replace(eventSessionsHref(event.id)),
        })
      }
    />
  );
}

function SessionForm({
  event,
  isPending,
  error,
  onSubmit,
}: {
  event: EventOverviewData["event"];
  isPending: boolean;
  error?: string;
  onSubmit: (values: CreateSessionFormValues) => void;
}) {
  // A new session starts on the event's first day, which is the likeliest one.
  const defaults = useMemo<CreateSessionFormValues>(
    () => ({
      ...emptySessionForm,
      date: toFormDateTime(event.startAt, event.timezone).date,
      speakers: [],
    }),
    [event.startAt, event.timezone],
  );
  const form = useForm<CreateSessionFormValues>({
    resolver: zodResolver(createSessionFormSchema),
    defaultValues: defaults,
  });
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = form;

  // After a failed save, move keyboard focus to the message.
  const errorBox = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) errorBox.current?.focus();
  }, [error]);

  return (
    <FormProvider {...form}>
      <form
        noValidate
        className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]"
        onSubmit={handleSubmit(onSubmit)}
      >
        <div className="min-w-0 space-y-5">
          {error && (
            <Alert
              ref={errorBox}
              tone="error"
              title="We couldn't add this session"
            >
              {error}
            </Alert>
          )}

          <SessionDetailsFields event={event} isPending={isPending} />

          <Card
            title="Speakers"
            description="Who presents this session. At least one speaker (not only moderators)."
          >
            <Controller
              control={control}
              name="speakers"
              render={({ field }) => (
                <SpeakerPicker
                  value={field.value}
                  onChange={field.onChange}
                  disabled={isPending}
                  error={
                    errors.speakers?.message ?? errors.speakers?.root?.message
                  }
                />
              )}
            />
          </Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4">
          <Card title="Status">
            <p className="text-muted">
              A new session is on the schedule as soon as it is saved. You can
              write its content and add a cover image afterwards.
            </p>
          </Card>
          <div className="space-y-2.5 rounded-lg border border-line bg-surface p-4">
            <Button type="submit" fullWidth isPending={isPending}>
              {isPending ? "Adding session…" : "Add session"}
            </Button>
            <Link
              href={eventSessionsHref(event.id)}
              className={buttonStyles({
                variant: "secondary",
                fullWidth: true,
              })}
            >
              Cancel
            </Link>
          </div>
        </aside>
      </form>
    </FormProvider>
  );
}
