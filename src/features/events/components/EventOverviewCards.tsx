import {
  Ban,
  CircleCheck,
  Trash2,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { formatCount } from "@/src/core/format/format-number";
import {
  Button,
  buttonStyles,
  Card,
  cn,
  DescriptionList,
  SourceBadge,
  type DescriptionItem,
} from "@/src/core/ui";
import type { EventOverviewData } from "../types/event-manage.types";
import type { AttentionItem } from "../utils/event-attention";
import { unscheduledCount } from "../utils/event-attention";
import {
  fillPercent,
  formatEventDates,
  formatEventTimes,
  formatTicketPrice,
  plural,
  venueLine,
} from "../utils/event-display";
import type { PublishChecklist } from "../utils/publish-checklist";
import { publicEventHref } from "../routes";
import { SeatsBar } from "./SeatsBar";

//* The four figures at the top

function Kpi({
  label,
  value,
  note,
  warn = false,
}: {
  label: string;
  value: string;
  note: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <p className="text-muted">{label}</p>
      <p className={cn("text-2xl font-semibold", warn && "text-warning")}>
        {value}
      </p>
      <p className="text-sm text-muted">{note}</p>
    </div>
  );
}

/** Registrations, sessions, halls and speakers. A draft has no registrations yet. */
export function KpiGrid({ overview }: { overview: EventOverviewData }) {
  const { event } = overview;
  const { total, scheduled } = event.sessions;
  const unscheduled = unscheduledCount(overview);
  const draft = event.status === "draft";
  const seatsLeft =
    event.capacity === null
      ? null
      : Math.max(event.capacity - event.registered, 0);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {draft ? (
        <Kpi label="Registrations" value="—" note="Opens when published" />
      ) : (
        <Kpi
          label="Registered"
          value={
            event.capacity === null
              ? formatCount(event.registered)
              : `${formatCount(event.registered)} / ${formatCount(event.capacity)}`
          }
          note={
            seatsLeft === null
              ? "No limit"
              : `${formatCount(seatsLeft)} seats left`
          }
        />
      )}
      {draft ? (
        <Kpi
          label="Sessions"
          value={String(total)}
          note={`${scheduled} scheduled`}
          warn={total > 0 && scheduled === 0}
        />
      ) : (
        <>
          <Kpi
            label="Session bookings"
            value={formatCount(overview.sessionBookings)}
            note={`across ${plural(scheduled, "scheduled session")}`}
          />
          <Kpi
            label="Sessions"
            value={String(total)}
            note={`${scheduled} scheduled${unscheduled > 0 ? ` · ${unscheduled} draft` : ""}`}
          />
        </>
      )}
      <Kpi
        label={draft ? "Halls" : "Halls · speakers"}
        value={
          draft
            ? String(overview.hallCount)
            : `${overview.hallCount} · ${overview.speakerCount}`
        }
        note={draft ? overview.hallNames.join(" · ") : "all halls in use"}
      />
      {draft && (
        <Kpi
          label="Speakers"
          value={String(overview.speakerCount)}
          note="assigned to sessions"
        />
      )}
    </div>
  );
}

//* A tick or a warning in a round badge

function StatusIcon({ ok, icon }: { ok: boolean; icon?: LucideIcon }) {
  const Icon = icon ?? (ok ? CircleCheck : TriangleAlert);
  return (
    <span
      className={cn(
        "mt-0.5 flex size-6 flex-none items-center justify-center rounded-full",
        ok ? "bg-success-soft text-success" : "bg-warning-soft text-warning",
      )}
    >
      <Icon aria-hidden="true" className="size-4" />
    </span>
  );
}

//* A draft: what is left before it can be published

export function PublishChecklistCard({
  checklist,
  onPublish,
  isPublishing = false,
}: {
  checklist: PublishChecklist;
  /** Publishes the event. Without it (not the organizer's own event) the button stays disabled. */
  onPublish?: () => void;
  isPublishing?: boolean;
}) {
  return (
    <Card
      title="Ready to publish?"
      description={
        checklist.canPublish
          ? "Everything is in place."
          : `${plural(checklist.missing.length, "thing")} ${checklist.missing.length === 1 ? "is" : "are"} still missing.`
      }
    >
      <ul className="divide-y divide-line">
        {checklist.items.map((item) => (
          <li key={item.key} className="flex items-start gap-3 py-3 first:pt-0">
            <StatusIcon ok={item.ok} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{item.title}</p>
              <p className="text-muted">{item.description}</p>
            </div>
            {item.action && (
              <Link
                href={item.action.href}
                className={buttonStyles({ variant: "secondary" })}
              >
                {item.action.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <div>
          {checklist.summary ? (
            <>
              <p className="font-semibold text-warning">{checklist.summary}</p>
              <p className="text-muted">Complete these to publish.</p>
            </>
          ) : (
            <p className="font-semibold text-success">Ready to publish</p>
          )}
        </div>
        <Button
          onClick={onPublish}
          isPending={isPublishing}
          disabled={!checklist.canPublish || !onPublish}
          title={
            onPublish ? undefined : "Only the event's organizer can publish it"
          }
        >
          Publish event
        </Button>
      </div>
    </Card>
  );
}

//* A published event: what needs a look

export function AttentionCard({ items }: { items: readonly AttentionItem[] }) {
  return (
    <Card title="Needs your attention">
      <ul className="divide-y divide-line">
        {items.map((item) => (
          <li
            key={item.key}
            className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
          >
            <span
              className={cn(
                "mt-0.5 flex size-6 flex-none items-center justify-center rounded-full",
                item.tone === "warning" && "bg-warning-soft text-warning",
                item.tone === "info" && "bg-info-soft text-info",
                item.tone === "success" && "bg-success-soft text-success",
              )}
            >
              {item.tone === "success" ? (
                <CircleCheck aria-hidden="true" className="size-4" />
              ) : (
                <TriangleAlert aria-hidden="true" className="size-4" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{item.title}</p>
              <p className="text-muted">{item.description}</p>
            </div>
            {item.action && (
              <Link
                href={item.action.href}
                className={buttonStyles({ variant: "secondary" })}
              >
                {item.action.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function RegistrationProgressCard({
  overview,
}: {
  overview: EventOverviewData;
}) {
  const { event } = overview;
  const { scheduled } = event.sessions;
  const seatsPercent = fillPercent(event.registered, event.capacity);

  return (
    <Card title="Registration progress">
      <div className="space-y-4">
        {event.capacity !== null && (
          <div>
            <div className="mb-1.5 flex justify-between gap-3">
              <strong>Registrations</strong>
              <span className="text-muted">
                {formatCount(event.registered)} of {formatCount(event.capacity)}{" "}
                · {seatsPercent}%
              </span>
            </div>
            <SeatsBar
              value={event.registered}
              max={event.capacity}
              label="Event seats taken"
            />
          </div>
        )}
        {scheduled > 0 && (
          <div>
            <div className="mb-1.5 flex justify-between gap-3">
              <strong>Sessions with seats left</strong>
              <span className="text-muted">
                {overview.sessionsWithSeatsLeft} of {scheduled}
              </span>
            </div>
            <SeatsBar
              value={overview.sessionsWithSeatsLeft}
              max={scheduled}
              label="Sessions with seats left"
              tone="success"
            />
          </div>
        )}
      </div>
    </Card>
  );
}

//* The side column

export function DetailsCard({
  overview,
  editHref,
}: {
  overview: EventOverviewData;
  /** Where "Edit" goes; hidden for an event that can no longer be edited. */
  editHref: string | null;
}) {
  const { event } = overview;
  const items: DescriptionItem[] = [
    {
      label: "Dates",
      value: formatEventDates(event.startAt, event.endAt, event.timezone, {
        weekday: true,
      }),
    },
    {
      label: "Time",
      value: formatEventTimes(event.startAt, event.endAt, event.timezone),
    },
    { label: "Venue", value: venueLine(event) },
    {
      label: "Capacity",
      value: event.capacity === null ? "No limit" : formatCount(event.capacity),
    },
    { label: "Ticket", value: formatTicketPrice(event.ticketPrice) },
    {
      label: "Public link",
      value: (
        <span className="font-normal text-muted">
          {publicEventHref(event.slug)}
        </span>
      ),
    },
  ];

  return (
    <Card
      title="Details"
      action={
        editHref && (
          <Link
            href={editHref}
            className="font-semibold text-link hover:underline"
          >
            Edit
          </Link>
        )
      }
    >
      <DescriptionList items={items} labelWidth="sm" />
    </Card>
  );
}

export function DangerZoneCard({
  status,
  onCancel,
  onDelete,
}: {
  status: "draft" | "published";
  onCancel: () => void;
  /** Deletes the draft. Without it the button stays off: there is no delete endpoint yet. */
  onDelete?: () => void;
}) {
  return (
    <Card title="Danger zone">
      {status === "draft" ? (
        <div className="space-y-3">
          <p className="text-muted">
            Removes this draft. This can’t be undone.
          </p>
          <Button
            variant="secondary"
            onClick={onDelete}
            disabled={!onDelete}
            className="text-danger"
          >
            <Trash2 aria-hidden="true" className="size-4" />
            Delete draft
          </Button>
          {!onDelete && (
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
              <SourceBadge source="static" />
              Deleting a draft is not available yet.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-muted">
            Cancelling keeps the event page visible with a cancelled banner and
            closes registration. Registered attendees are notified, and their
            session bookings are cancelled.
          </p>
          <Button
            variant="secondary"
            onClick={onCancel}
            className="text-danger"
          >
            <Ban aria-hidden="true" className="size-4" />
            Cancel event
          </Button>
        </div>
      )}
    </Card>
  );
}
