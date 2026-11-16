"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useState, type ReactNode } from "react";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { Alert, Breadcrumb, Button, buttonStyles } from "@/src/core/ui";
import { useCreateEvent } from "../hooks/useCreateEvent";
import { useGetEventOverview } from "../hooks/useGetEventOverview";
import { useUpdateEvent } from "../hooks/useUpdateEvent";
import {
  eventEditHref,
  eventHref,
  EVENT_ROUTES,
  type EventStep,
} from "../routes";
import {
  toCreateEventRequest,
  toUpdateEventRequest,
} from "../schemas/event-form.schemas";
import { isEditable } from "../utils/event-display";
import { EventContentStep } from "./EventContentStep";
import { EventForm } from "./EventForm";
import { EventMediaStep } from "./EventMediaStep";
import { EventStepper } from "./EventStepper";

/**
 * The page around the event form: breadcrumb, heading and the three steps (details, content,
 * media). Without an `eventId` it creates a new event; the first step saves it (a draft) and
 * moves on to the content step, whose address holds the new id. With an `eventId` it edits that
 * event (loaded from the API) on the given `step`; saving a step opens the next one, and the
 * last one finishes on the event's overview.
 */
export function EventFormPage({
  eventId,
  step = "details",
}: {
  eventId?: string;
  step?: EventStep;
}) {
  return eventId ? (
    <EditEvent eventId={eventId} step={step} />
  ) : (
    <CreateEvent />
  );
}

/** Heading and breadcrumb; `event` is the event being edited, if any. */
function PageFrame({
  event,
  description,
  children,
}: {
  event?: { id: string; title: string };
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="space-y-3">
        <Breadcrumb
          items={[
            { label: "My events", href: EVENT_ROUTES.list },
            ...(event
              ? [
                  { label: event.title, href: eventHref(event.id) },
                  { label: "Edit" },
                ]
              : [{ label: "New event" }]),
          ]}
        />
        <div>
          <h1 className="text-2xl font-semibold">
            {event ? "Edit event" : "Create event"}
          </h1>
          <p className="text-muted">
            {description ??
              (event
                ? event.title
                : "A new event is saved as a draft. Publish it when it is ready.")}
          </p>
        </div>
      </header>
      {children}
    </div>
  );
}

function CreateEvent() {
  const router = useRouter();
  const create = useCreateEvent();
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
    <PageFrame>
      <EventStepper current="details" />
      <EventForm
        key={formKey}
        onSubmit={(values) =>
          create.mutate(toCreateEventRequest(values), {
            // The draft exists now (and the lists and counts were refreshed by the hook): move
            // on to its content, replacing this page so Back does not return to an empty form.
            onSuccess: (event) =>
              router.replace(eventEditHref(event.id, "content")),
          })
        }
        isPending={create.isPending}
        error={create.error?.message}
      />
    </PageFrame>
  );
}

function EditEvent({ eventId, step }: { eventId: string; step: EventStep }) {
  const router = useRouter();
  const overview = useGetEventOverview(eventId);
  const update = useUpdateEvent(eventId);
  const [formKey, setFormKey] = useState(0);
  useLayoutEffect(
    () => () => {
      update.reset();
      setFormKey((key) => key + 1);
    },
    // `update.reset` is stable; this must run only when the page is hidden.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  if (overview.isPending) {
    return (
      <PageFrame description="Loading the event…">
        <div
          role="status"
          aria-label="Loading event"
          className="animate-pulse space-y-4 motion-reduce:animate-none"
        >
          <div className="h-32 rounded-lg bg-surface-subtle" />
          <div className="h-48 rounded-lg bg-surface-subtle" />
        </div>
      </PageFrame>
    );
  }

  if (overview.isError) {
    // A 404 is final (not the organizer's event, or deleted); anything else may pass.
    const notFound =
      overview.error instanceof ApiError && overview.error.status === 404;
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Alert
          tone="error"
          title={notFound ? "Event not found" : "We couldn't load this event"}
        >
          {notFound
            ? "It may have been deleted, or it is not one of your events."
            : overview.error.message}
        </Alert>
        <div className="flex flex-wrap gap-2.5">
          {!notFound && (
            <Button variant="secondary" onClick={() => void overview.refetch()}>
              Try again
            </Button>
          )}
          <Link
            href={EVENT_ROUTES.list}
            className={buttonStyles({ variant: "secondary" })}
          >
            Back to My events
          </Link>
        </div>
      </div>
    );
  }

  const { event, content } = overview.data;

  if (!isEditable(event.status)) {
    return (
      <PageFrame event={event}>
        <Alert
          tone="warning"
          title={
            event.status === "cancelled"
              ? "This event is cancelled"
              : "This event has ended"
          }
        >
          A {event.status} event can no longer be edited.{" "}
          <Link href={eventHref(event.id)} className="font-semibold underline">
            Back to the overview
          </Link>
        </Alert>
      </PageFrame>
    );
  }

  return (
    <PageFrame event={event}>
      <EventStepper
        eventId={eventId}
        current={step}
        done={{
          details: true,
          // null = the CMS did not answer: unknown, so no tick.
          content: content?.hasDescription,
          media: content?.hasBanner,
        }}
      />
      {step === "details" && (
        <EventForm
          key={formKey}
          event={event}
          onSubmit={(values) =>
            update.mutate(toUpdateEventRequest(values), {
              onSuccess: () => router.push(eventEditHref(eventId, "content")),
            })
          }
          isPending={update.isPending}
          error={update.error?.message}
        />
      )}
      {step === "content" && (
        <EventContentStep
          eventId={eventId}
          onContinue={() => router.push(eventEditHref(eventId, "media"))}
        />
      )}
      {step === "media" && <EventMediaStep eventId={eventId} />}
    </PageFrame>
  );
}
