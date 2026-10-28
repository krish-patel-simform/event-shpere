import Link from "next/link";
import { Badge, Card } from "@/src/core/ui";
import type {
  SpeakerSession,
  SpeakerSessionStatus,
} from "../../types/speaker-home";
import { formatTimeRange } from "../../utils/home-format";
import { DateTile } from "../DateTile";
import { EmptyState } from "../EmptyState";
import { ProgressBar } from "../ProgressBar";

const STATUS_BADGES: Record<
  SpeakerSessionStatus,
  { label: string; tone: "success" | "warning" | "danger" }
> = {
  confirmed: { label: "Confirmed", tone: "success" },
  under_review: { label: "Under review", tone: "warning" },
  declined: { label: "Declined", tone: "danger" },
};

/** A session counts as "almost full" from this share of its seats. */
const ALMOST_FULL = 0.9;

function Seats({ session }: { session: SpeakerSession }) {
  if (session.seatsFilled === null || session.seatsTotal === null) {
    return <span className="text-xs text-muted">Not scheduled yet</span>;
  }
  const almostFull = session.seatsFilled / session.seatsTotal >= ALMOST_FULL;

  return (
    <div className="w-44">
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-muted">Seats</span>
        <span
          className={
            almostFull ? "font-semibold text-warning" : "font-semibold"
          }
        >
          {session.seatsFilled} / {session.seatsTotal}
          {almostFull && " · almost full"}
        </span>
      </div>
      <ProgressBar
        value={session.seatsFilled}
        max={session.seatsTotal}
        label={`Seats taken in ${session.title}`}
        tone={almostFull ? "warning" : "brand"}
      />
    </div>
  );
}

function SessionRow({ session }: { session: SpeakerSession }) {
  const badge = STATUS_BADGES[session.status];
  const meta = [
    session.startsAt && session.endsAt
      ? formatTimeRange(session.startsAt, session.endsAt)
      : null,
    session.room,
    session.format,
    session.note,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="flex flex-wrap items-center gap-4 border-b border-line px-5 py-4 last:border-b-0">
      <DateTile iso={session.startsAt} />
      <div className="min-w-0 flex-1 basis-60">
        {session.status === "confirmed" ? (
          <Link
            href={`/speaker/sessions/${session.id}`}
            className="font-semibold hover:underline"
          >
            {session.title}
          </Link>
        ) : (
          <p className="font-semibold">{session.title}</p>
        )}
        <p className="text-sm text-muted">{meta}</p>
      </div>
      <Seats session={session} />
      <Badge tone={badge.tone}>{badge.label}</Badge>
    </li>
  );
}

/** The speaker's sessions: scheduled ones with their seats, and ones still under review. */
export function SpeakerSessionsCard({
  sessions,
}: {
  sessions: readonly SpeakerSession[];
}) {
  return (
    <Card
      title="Your sessions"
      flush
      action={
        <Link
          href="/speaker/sessions"
          className="text-sm font-semibold text-link"
        >
          View all
        </Link>
      }
    >
      {sessions.length === 0 ? (
        <EmptyState>No sessions yet.</EmptyState>
      ) : (
        <ul>
          {sessions.map((session) => (
            <SessionRow key={session.id} session={session} />
          ))}
        </ul>
      )}
    </Card>
  );
}
