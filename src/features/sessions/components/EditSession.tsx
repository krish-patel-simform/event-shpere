"use client";

import { Ban } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useState } from "react";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { skipToken, useQuery } from "@tanstack/react-query";
import { Alert, Breadcrumb, Button, buttonStyles } from "@/src/core/ui";
import {
  EventLoader,
  eventHref,
  eventSessionsHref,
  EVENT_ROUTES,
  isEventEditable,
  type EventOverviewData,
} from "../../events";
import { sessionQueryKeys } from "../hooks/session-cache";
import { useCancelSession } from "../hooks/useCancelSession";
import { useGetSession } from "../hooks/useGetSession";
import { eventSessionEditHref, type SessionStep } from "../routes";
import type { SessionDto } from "../schemas/sessions.schemas";
import { CancelSessionDialog } from "./CancelSessionDialog";
import { SessionContentStep } from "./SessionContentStep";
import { SessionCoverStep } from "./SessionCoverStep";
import { SessionDetailsStep } from "./SessionDetailsStep";
import { SessionStepper } from "./SessionStepper";

/**
 * The page that edits one session of an event, in three steps: details (time, hall, price and the
 * speakers), content and cover image. The URL holds the step (`?step=`), saving a step opens the
 * next, and the last one finishes on the event's sessions. The event loads first (its dates limit
 * the date, its venue gives the halls, and whether it can still change), then the session.
 */
export function EditSession({
  eventId,
  sessionId,
  step = "details",
}: {
  eventId: string;
  sessionId: string;
  step?: SessionStep;
}) {
  return (
    <EventLoader eventId={eventId}>
      {(overview) => (
        <EditSessionPage
          overview={overview}
          sessionId={sessionId}
          step={step}
        />
      )}
    </EventLoader>
  );
}

function EditSessionPage({
  overview,
  sessionId,
  step,
}: {
  overview: EventOverviewData;
  sessionId: string;
  step: SessionStep;
}) {
  const { event } = overview;
  const router = useRouter();
  const session = useGetSession(event.id, sessionId);
  const listHref = eventSessionsHref(event.id);
  const go = (next: SessionStep) =>
    router.push(eventSessionEditHref(event.id, sessionId, next));

  // Leaving the page hides it (React <Activity>) instead of unmounting it, so a half-edited form
  // would still be there when the organizer comes back. A new key mounts the steps fresh.
  const [stepsKey, setStepsKey] = useState(0);

  // "Cancel session" asks first. The dialog is closed too when the page is hidden.
  const cancel = useCancelSession(event.id);
  const [cancelling, setCancelling] = useState<SessionDto | null>(null);
  function closeCancelDialog() {
    setCancelling(null);
    cancel.reset();
  }
  useLayoutEffect(
    () => () => {
      setStepsKey((key) => key + 1);
      setCancelling(null);
    },
    [],
  );

  // The header names the session being edited, and never says "Edit session". The name is known
  // before the session itself has loaded when the organizer came from the Sessions list (or just
  // added the session): that list is already in the cache. `skipToken` only reads it, it never
  // asks the server. Only the name is taken from it; the form waits for the fresh session.
  const cachedList = useQuery<SessionDto[]>({
    queryKey: sessionQueryKeys.list(event.id),
    queryFn: skipToken,
  });
  const headerTitle =
    session.data?.title ??
    cachedList.data?.find((item) => item.id === sessionId)?.title;

  // The line under the name is the event it belongs to. With no name at all yet, the name's place
  // is a placeholder bar while the session loads, and plain "Session" if it never will.
  const frame = (children: React.ReactNode) => (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="space-y-3">
        <Breadcrumb
          items={[
            { label: "My events", href: EVENT_ROUTES.list },
            { label: event.title, href: eventHref(event.id) },
            { label: "Sessions", href: listHref },
            { label: headerTitle ?? "Session" },
          ]}
        />
        <div>
          {headerTitle || !session.isPending ? (
            <h1 className="text-2xl font-semibold">
              {headerTitle ?? "Session"}
            </h1>
          ) : (
            <div
              aria-hidden="true"
              className="h-8 w-72 max-w-full animate-pulse rounded bg-surface-subtle motion-reduce:animate-none"
            />
          )}
          <p className="text-muted">{event.title}</p>
        </div>
      </header>
      {children}
    </div>
  );

  if (session.isPending) {
    return frame(
      <div
        role="status"
        aria-label="Loading session"
        className="animate-pulse space-y-4 motion-reduce:animate-none"
      >
        <div className="h-16 rounded-lg bg-surface-subtle" />
        <div className="h-64 rounded-lg bg-surface-subtle" />
      </div>,
    );
  }

  if (session.isError) {
    // A 404 is final (not in this event, or removed); anything else may pass.
    const notFound =
      session.error instanceof ApiError && session.error.status === 404;
    return frame(
      <div className="max-w-3xl space-y-4">
        <Alert
          tone="error"
          title={
            notFound ? "Session not found" : "We couldn't load this session"
          }
        >
          {notFound
            ? "It may have been removed, or it is not in this event."
            : session.error.message}
        </Alert>
        <div className="flex flex-wrap gap-2.5">
          {!notFound && (
            <Button variant="secondary" onClick={() => void session.refetch()}>
              Try again
            </Button>
          )}
          <Link
            href={listHref}
            className={buttonStyles({ variant: "secondary" })}
          >
            Back to sessions
          </Link>
        </div>
      </div>,
    );
  }

  const data = session.data;

  if (!isEventEditable(event.status) || data.status === "cancelled") {
    return frame(
      <div className="max-w-3xl space-y-4">
        <Alert tone="warning" title="This session can no longer be edited">
          {data.status === "cancelled"
            ? "A cancelled session is read-only."
            : event.status === "cancelled"
              ? "This event is cancelled."
              : "This event has ended."}
        </Alert>
        <Link
          href={listHref}
          className={buttonStyles({ variant: "secondary" })}
        >
          Back to sessions
        </Link>
      </div>,
    );
  }

  return frame(
    <>
      <div className="flex justify-end">
        <Button
          variant="secondary"
          className="text-danger"
          onClick={() => setCancelling(data)}
        >
          <Ban aria-hidden="true" className="size-4" />
          Cancel session
        </Button>
      </div>
      <SessionStepper
        eventId={event.id}
        sessionId={sessionId}
        current={step}
        done={{ details: true }}
      />
      <div key={stepsKey}>
        {step === "details" && (
          <SessionDetailsStep
            event={event}
            session={data}
            cancelHref={listHref}
            onSaved={() => go("content")}
          />
        )}
        {step === "content" && (
          <SessionContentStep
            eventId={event.id}
            sessionId={sessionId}
            backHref={eventSessionEditHref(event.id, sessionId, "details")}
            onContinue={() => go("cover")}
          />
        )}
        {step === "cover" && (
          <SessionCoverStep
            eventId={event.id}
            sessionId={sessionId}
            backHref={eventSessionEditHref(event.id, sessionId, "content")}
            finishHref={listHref}
          />
        )}
      </div>
      <CancelSessionDialog
        session={cancelling}
        isPending={cancel.isPending}
        error={cancel.isError ? cancel.error.message : null}
        onClose={closeCancelDialog}
        // A cancelled session is read-only, so on to the list where it shows as cancelled.
        onConfirm={(target) =>
          cancel.mutate(target.id, {
            onSuccess: () => {
              setCancelling(null);
              router.push(listHref);
            },
          })
        }
      />
    </>,
  );
}
