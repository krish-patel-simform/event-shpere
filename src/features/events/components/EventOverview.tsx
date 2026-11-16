"use client";

import { Ban, ExternalLink, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useState } from "react";
import { Alert, Button, buttonStyles } from "@/src/core/ui";
import { useHasPermission } from "@/src/features/auth";
import { useCancelEvent } from "../hooks/useCancelEvent";
import { useDeleteEvent } from "../hooks/useDeleteEvent";
import { useGetEventContent } from "../hooks/useGetEventContent";
import { usePublishEvent } from "../hooks/usePublishEvent";
import {
  eventEditHref,
  eventSessionNewHref,
  EVENT_ROUTES,
  publicEventHref,
} from "../routes";
import type {
  EventOverviewData,
  ManagedEvent,
} from "../types/event-manage.types";
import { getAttentionItems } from "../utils/event-attention";
import { isEditable } from "../utils/event-display";
import { getPublishChecklist } from "../utils/publish-checklist";
import {
  CoverStrip,
  CoverStripSkeleton,
  EventContentOverview,
  QuickActionsCard,
} from "./EventContentCards";
import { CancelEventDialog, DeleteDraftDialog } from "./EventDialogs";
import {
  AttentionCard,
  DangerZoneCard,
  DetailsCard,
  KpiGrid,
  PublishChecklistCard,
  RegistrationProgressCard,
} from "./EventOverviewCards";
import { EventLoader } from "./EventLoader";
import { EventPageHeader } from "./EventPageHeader";

/**
 * The organizer's page for one event, loaded from GET /api/events/[id]: its cover, status and
 * figures, what is left before a draft can be published, what a published event needs attention
 * for, the page content, its details, and the danger zone (cancel a published event). Publishing
 * and deleting a draft come with their endpoints and stay off until then.
 */
export function EventOverview({ eventId }: { eventId: string }) {
  return (
    <EventLoader eventId={eventId}>
      {(overview) => <OverviewPage overview={overview} />}
    </EventLoader>
  );
}

/** The overview of one loaded event. */
function OverviewPage({ overview }: { overview: EventOverviewData }) {
  const { event } = overview;
  const editable = isEditable(event.status);
  const canCreateSession = useHasPermission("SESSION_CREATE");
  const checklist = getPublishChecklist({
    eventId: event.id,
    hasVenue: event.venue !== null,
    hallCount: overview.hallCount,
    content: overview.content,
    sessions: event.sessions,
  });

  // The cover strip and the content sections read the same answer of the CMS.
  const content = useGetEventContent(event.id);

  // "Cancel event" asks first; the dialog is closed when the page is hidden (React <Activity>
  // keeps it mounted), and when the answer comes, whether it worked or not.
  const [cancelling, setCancelling] = useState<ManagedEvent | null>(null);
  const cancel = useCancelEvent();
  useLayoutEffect(() => () => setCancelling(null), []);

  // "Delete draft" asks first, the same way. When it worked the event is gone, so the page leaves
  // for the events list (a client navigation: no reload); the dialog closes either way.
  const router = useRouter();
  const [deleting, setDeleting] = useState<ManagedEvent | null>(null);
  const remove = useDeleteEvent();
  useLayoutEffect(() => () => setDeleting(null), []);

  // Publishing is the organizer's own action (EVENT_PUBLISH_OWN); the API refuses anyone else.
  const canPublish = useHasPermission("EVENT_PUBLISH_OWN");
  const publish = usePublishEvent();

  function askToCancel() {
    cancel.reset();
    setCancelling(event);
  }
  function confirmCancel(target: ManagedEvent) {
    if (cancel.isPending) return;
    cancel.mutate(target.id, { onSettled: () => setCancelling(null) });
  }
  function askToDelete() {
    remove.reset();
    setDeleting(event);
  }
  function confirmDelete(target: ManagedEvent) {
    if (remove.isPending) return;
    remove.mutate(target.id, {
      onSuccess: () => router.push(EVENT_ROUTES.list),
      onSettled: () => setDeleting(null),
    });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <EventPageHeader
        overview={overview}
        current="overview"
        actions={
          <>
            {/* A draft has no public page yet (it would be a 404): the link comes with publishing. */}
            {event.status !== "draft" && (
              <Link
                href={publicEventHref(event.slug)}
                className={buttonStyles({ variant: "secondary" })}
              >
                <ExternalLink aria-hidden="true" className="size-4" />
                View public page
              </Link>
            )}
            {editable && canCreateSession && (
              <Link
                href={eventSessionNewHref(event.id)}
                className={buttonStyles({ variant: "secondary" })}
              >
                <Plus aria-hidden="true" className="size-4" />
                Create session
              </Link>
            )}
            {event.status === "published" && (
              <Button
                variant="secondary"
                className="text-danger"
                onClick={askToCancel}
              >
                <Ban aria-hidden="true" className="size-4" />
                Cancel event
              </Button>
            )}
            {editable && (
              <Link
                href={eventEditHref(event.id)}
                className={buttonStyles({ variant: "primary" })}
              >
                <Pencil aria-hidden="true" className="size-4" />
                Edit event
              </Link>
            )}
          </>
        }
      />

      {event.status === "cancelled" && (
        <Alert tone="error" title="This event is cancelled">
          Registration is closed, and the event page shows a cancelled banner.
        </Alert>
      )}
      {event.status === "completed" && (
        <Alert tone="info" title="This event has ended">
          A completed event is read-only.
        </Alert>
      )}
      {publish.isSuccess && (
        <Alert tone="success" title={`${publish.data.title} was published`}>
          Attendees can now find it and register.
          <Link
            href={publicEventHref(publish.data.slug)}
            className={buttonStyles({ variant: "secondary" }) + " mt-3"}
          >
            <ExternalLink aria-hidden="true" className="size-4" />
            View public page
          </Link>
        </Alert>
      )}
      {publish.isError && (
        <Alert tone="error" title="We couldn't publish the event">
          {publish.error.message}
        </Alert>
      )}
      {cancel.isSuccess && (
        <Alert tone="success" title={`${cancel.data.title} was cancelled`} />
      )}
      {cancel.isError && (
        <Alert tone="error" title="We couldn't cancel the event">
          {cancel.error.message}
        </Alert>
      )}
      {remove.isError && (
        <Alert tone="error" title="We couldn't delete the draft">
          {remove.error.message}
        </Alert>
      )}

      {/* The strip's place is held while the content loads, so the page below does not jump. */}
      {content.isPending && <CoverStripSkeleton />}
      {content.isSuccess && (
        <CoverStrip
          eventId={event.id}
          cover={content.data.coverImage}
          editable={editable}
        />
      )}

      <KpiGrid overview={overview} />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-5">
          {event.status === "draft" && (
            <PublishChecklistCard
              checklist={checklist}
              onPublish={
                canPublish ? () => publish.mutate(event.id) : undefined
              }
              isPublishing={publish.isPending}
            />
          )}
          {event.status === "published" && (
            <>
              <AttentionCard items={getAttentionItems(overview)} />
              <RegistrationProgressCard overview={overview} />
            </>
          )}
          {event.status === "completed" && (
            <RegistrationProgressCard overview={overview} />
          )}
          <EventContentOverview
            eventId={event.id}
            editable={editable}
            content={content}
          />
        </div>
        <div className="space-y-5">
          <DetailsCard
            overview={overview}
            editHref={editable ? eventEditHref(event.id) : null}
          />
          {event.status !== "cancelled" && <QuickActionsCard />}
          {(event.status === "draft" || event.status === "published") && (
            <DangerZoneCard
              status={event.status}
              onCancel={askToCancel}
              onDelete={askToDelete}
            />
          )}
        </div>
      </div>

      <CancelEventDialog
        event={cancelling}
        isPending={cancel.isPending}
        onClose={() => setCancelling(null)}
        onConfirm={confirmCancel}
      />
      <DeleteDraftDialog
        event={deleting}
        isPending={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
