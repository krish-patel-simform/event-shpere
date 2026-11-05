"use client";

import { ExternalLink, Pencil } from "lucide-react";
import Link from "next/link";
import { Alert, buttonStyles } from "@/src/core/ui";
import { eventEditHref, publicEventHref } from "../routes";
import type { EventOverviewData } from "../types/event-manage.types";
import { getAttentionItems } from "../utils/event-attention";
import { isEditable } from "../utils/event-display";
import { getPublishChecklist } from "../utils/publish-checklist";
import {
  AttentionCard,
  DetailsCard,
  KpiGrid,
  PublishChecklistCard,
  RegistrationProgressCard,
} from "./EventOverviewCards";
import { EventLoader } from "./EventLoader";
import { EventPageHeader } from "./EventPageHeader";

/**
 * The organizer's page for one event, loaded from GET /api/events/[id]: its status and figures,
 * what is left before a draft can be published, what a published event needs attention for, and
 * its details. Publishing, cancelling and deleting come with their endpoints.
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
  const checklist = getPublishChecklist({
    eventId: event.id,
    hasVenue: event.venue !== null,
    hallCount: overview.hallCount,
    content: overview.content,
    sessions: event.sessions,
  });

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <EventPageHeader
        overview={overview}
        current="overview"
        actions={
          <>
            <Link
              href={publicEventHref(event.slug)}
              className={buttonStyles({ variant: "secondary" })}
            >
              <ExternalLink aria-hidden="true" className="size-4" />
              View public page
            </Link>
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

      <KpiGrid overview={overview} />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-5">
          {event.status === "draft" && (
            <PublishChecklistCard checklist={checklist} />
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
        </div>
        <div className="space-y-5">
          <DetailsCard
            overview={overview}
            editHref={editable ? eventEditHref(event.id) : null}
          />
        </div>
      </div>
    </div>
  );
}
