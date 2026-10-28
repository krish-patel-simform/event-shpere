import { CalendarDays, Clock, FileText, MapPin } from "lucide-react";
import { formatDate } from "@/src/core/format/format-date";
import { formatCount } from "@/src/core/format/format-number";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  cn,
  DescriptionList,
} from "@/src/core/ui";
import type { SessionItem } from "../types/session";
import {
  ALMOST_FULL_PERCENT,
  fillPercent,
  formatAndDuration,
  formatDayFull,
  formatDayMonth,
  formatFileSize,
  formatTimeRange,
  levelLabel,
  sessionStatusBadge,
  trackLabel,
  trendBarHeights,
} from "../utils/session-display";

const NOT_AVAILABLE_NOTE_ID = "session-actions-note";

/** Title, badges, when and where. Editing and the live console are shown as not available yet. */
export function SessionHeaderCard({ session }: { session: SessionItem }) {
  const status = sessionStatusBadge(session.status);
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0 flex-1 basis-96">
          <div className="mb-2.5 flex flex-wrap gap-2">
            <Badge tone={status.tone}>{status.label}</Badge>
            <Badge>{formatAndDuration(session)}</Badge>
            <Badge tone="brand">{trackLabel(session)}</Badge>
            <Badge>{levelLabel(session)}</Badge>
          </div>
          <h1 className="text-2xl font-semibold leading-snug">
            {session.title}
          </h1>
          <p className="mt-1 text-muted">{session.eventName}</p>
          <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
            {session.startsAt && session.endsAt ? (
              <>
                <MetaItem
                  icon={CalendarDays}
                  text={formatDayFull(session.startsAt)}
                />
                <MetaItem
                  icon={Clock}
                  text={`${formatTimeRange(session.startsAt, session.endsAt)} UTC`}
                />
              </>
            ) : (
              <MetaItem icon={CalendarDays} text="Not scheduled yet" />
            )}
            {session.room && <MetaItem icon={MapPin} text={session.room} />}
          </ul>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button
            variant="secondary"
            disabled
            aria-describedby={NOT_AVAILABLE_NOTE_ID}
          >
            Edit details
          </Button>
          <Button disabled aria-describedby={NOT_AVAILABLE_NOTE_ID}>
            Open live console
          </Button>
        </div>
      </div>
      <p id={NOT_AVAILABLE_NOTE_ID} className="mt-3 text-sm text-muted">
        Editing a session and the live console are not available yet.
      </p>
    </Card>
  );
}

function MetaItem({ icon: Icon, text }: { icon: typeof Clock; text: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <Icon aria-hidden="true" className="size-4 text-muted" />
      {text}
    </li>
  );
}

/** The abstract and what attendees will learn. */
export function AboutCard({ session }: { session: SessionItem }) {
  return (
    <Card title="About this session">
      <p className="whitespace-pre-line">{session.abstract}</p>
      {session.takeaways.length > 0 && (
        <>
          <h3 className="mb-2 mt-5 text-sm font-semibold">
            Attendees will learn
          </h3>
          <ul className="list-disc space-y-1.5 pl-5">
            {session.takeaways.map((takeaway) => (
              <li key={takeaway}>{takeaway}</li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

/** The files for this session. Uploading is not built yet, and the card says so. */
export function MaterialsCard({ session }: { session: SessionItem }) {
  return (
    <Card
      title="Presentation materials"
      action={
        session.materialsDueAt && (
          <span className="text-sm text-muted">
            Due {formatDate(session.materialsDueAt)}
          </span>
        )
      }
    >
      <Alert tone="info" title="Uploading files is not available yet">
        Slides cannot be added or replaced from here for now. Files already on
        the session are listed below.
      </Alert>
      {session.materials.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No files yet.</p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {session.materials.map((file) => (
            <li
              key={file.fileName}
              className="flex items-center gap-3 rounded-md border border-line p-3"
            >
              <span
                aria-hidden="true"
                className="grid size-9 shrink-0 place-items-center rounded bg-danger-soft text-xs font-bold text-danger"
              >
                {file.kind}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 font-semibold">
                  <FileText aria-hidden="true" className="size-4 shrink-0" />
                  <span className="break-all">{file.fileName}</span>
                </p>
                <p className="text-sm text-muted">
                  {formatFileSize(file.sizeBytes)} · Uploaded{" "}
                  {formatDate(file.uploadedAt)} · Visible to{" "}
                  {file.visibility === "organizers"
                    ? "organizers only"
                    : "attendees"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Other people presenting this session, and whether they accepted. */
export function CoSpeakersCard({ session }: { session: SessionItem }) {
  return (
    <Card title="Co-speakers">
      {session.coSpeakers.length === 0 ? (
        <p className="text-sm text-muted">
          No co-speakers. You are presenting this session on your own.
        </p>
      ) : (
        <ul className="space-y-3">
          {session.coSpeakers.map((person) => (
            <li key={person.name} className="flex items-center gap-3">
              <Avatar name={person.name} className="size-10" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{person.name}</p>
                <p className="text-sm text-muted">{person.role}</p>
              </div>
              {person.invitation === "accepted" ? (
                <Badge tone="success">Accepted</Badge>
              ) : (
                <Badge tone="warning">Invitation pending</Badge>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Seats taken, the last days of sign-ups and, once it is over, who came and how it was rated. */
export function RegistrationsCard({ session }: { session: SessionItem }) {
  const { registrations, attended, rating, registrationTrend } = session;

  return (
    <Card title={attended !== null ? "Attendance" : "Registrations"}>
      {registrations ? (
        <SeatsTaken
          title={session.title}
          registered={registrations.registered}
          capacity={registrations.capacity}
        />
      ) : attended !== null ? (
        <div>
          <p className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold">
              {formatCount(attended)}
            </span>
            <span className="text-muted">attended</span>
          </p>
          {rating !== null && (
            <p className="mt-1 text-sm text-muted">
              Rated {rating.toFixed(1)} / 5 by attendees
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted">
          Registrations open once the session is scheduled.
        </p>
      )}
      {registrationTrend.length > 0 && (
        <RegistrationTrend days={registrationTrend} />
      )}
    </Card>
  );
}

function SeatsTaken({
  title,
  registered,
  capacity,
}: {
  title: string;
  registered: number;
  capacity: number;
}) {
  const percent = fillPercent(registered, capacity);
  const almostFull = percent >= ALMOST_FULL_PERCENT;
  return (
    <div>
      <p className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold">
          {formatCount(registered)}
        </span>
        <span className="text-muted">of {formatCount(capacity)} seats</span>
      </p>
      <div
        role="progressbar"
        aria-label={`Seats taken for ${title}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="my-2.5 h-2 overflow-hidden rounded-full bg-surface-subtle"
      >
        <div
          style={{ width: `${percent}%` }}
          className={cn("h-full", almostFull ? "bg-warning" : "bg-brand")}
        />
      </div>
      <p className="text-sm text-muted">
        {formatCount(Math.max(0, capacity - registered))} seats remaining
        {almostFull && (
          <span className="font-semibold text-warning"> · Almost full</span>
        )}
      </p>
    </div>
  );
}

/** Small bar chart of new registrations per day. The numbers are printed, so it reads as text too. */
function RegistrationTrend({
  days,
}: {
  days: SessionItem["registrationTrend"];
}) {
  const heights = trendBarHeights(days);
  const first = days[0];
  const last = days[days.length - 1];
  const summary = `Daily registrations from ${formatDayMonth(first.date)} to ${formatDayMonth(last.date)}: ${days.map((day) => day.count).join(", ")}`;

  return (
    <div className="mt-5">
      <h3 className="mb-2.5 text-sm font-semibold">
        New registrations, last {days.length} days
      </h3>
      <div role="img" aria-label={summary}>
        <div className="flex h-36 items-end gap-2 border-b border-line">
          {days.map((day, index) => (
            <div
              key={day.date}
              aria-hidden="true"
              className="flex h-full flex-1 flex-col items-center justify-end gap-1"
            >
              <span className="text-xs text-muted">{day.count}</span>
              <div
                style={{ height: `${heights[index] * 0.8}%` }}
                className={cn(
                  "w-full rounded-t-sm",
                  index === days.length - 1 ? "bg-brand" : "bg-brand/40",
                )}
              />
            </div>
          ))}
        </div>
        <div
          aria-hidden="true"
          className="mt-1.5 flex gap-2 text-xs text-muted"
        >
          {days.map((day) => (
            <span key={day.date} className="flex-1 text-center">
              {formatDayMonth(day.date)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Room, layout, check-in, AV and host: known once the organizers have scheduled the session. */
export function LogisticsCard({ session }: { session: SessionItem }) {
  const { logistics, room } = session;
  return (
    <Card title="Room & logistics">
      {logistics && room ? (
        <DescriptionList
          labelWidth="sm"
          items={[
            { label: "Room", value: room },
            { label: "Layout", value: logistics.layout },
            { label: "Check-in", value: logistics.checkIn },
            { label: "AV", value: logistics.av },
            { label: "Host", value: logistics.host },
          ]}
        />
      ) : (
        <p className="text-sm text-muted">
          The room and logistics are shared once the organizers schedule this
          session.
        </p>
      )}
    </Card>
  );
}
