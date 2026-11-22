"use client";

import {
  CalendarDays,
  CircleAlert,
  CircleCheck,
  Clock,
  MapPin,
  RotateCcw,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Alert, Badge, Button, cn, Spinner, TextField } from "@/src/core/ui";
import { useCheckInQueue, type CheckInEntry } from "../hooks/useCheckInQueue";
import {
  checkInResult,
  normalizeTicketCode,
  TICKET_CODE_MAX_LENGTH,
  type CheckInContext,
  type CheckInOutcome,
  type CheckInResultTone,
} from "../utils/check-in-result";

const TONES: Record<CheckInResultTone, { box: string; icon: LucideIcon }> = {
  success: {
    box: "border-success/30 bg-success-soft text-success",
    icon: CircleCheck,
  },
  warning: {
    box: "border-warning/40 bg-warning-soft text-warning",
    icon: TriangleAlert,
  },
  danger: {
    box: "border-danger/40 bg-danger-soft text-danger",
    icon: CircleAlert,
  },
};

export type CheckInPanelProps = {
  title: string;
  description: string;
  /** The rule under the form ("Check-ins can't be undone…"). */
  rules: string;
  /**
   * The door at this moment: the context a code is checked with, or why the door is shut (the
   * form is switched off; the earlier results stay).
   */
  door:
    | { open: true; context: CheckInContext }
    | { open: false; title: string; detail: string };
  /** Shown above the form, e.g. the event door's day picker. */
  controls?: ReactNode;
  /** The event's zone, for the time of a check-in. */
  timezone: string;
  send: (code: string, context: CheckInContext) => Promise<CheckInOutcome>;
  /** Where "check them in at the event door first" links to (session door only). */
  eventDoorHref?: string;
};

/**
 * A check-in door: type (or scan) a ticket code and press Enter. Every code gets its own row with
 * the server's answer, because that answer decides whether the person goes in. The form never
 * waits: the next code can be typed while earlier ones are checked, one at a time, in order.
 */
export function CheckInPanel({
  title,
  description,
  rules,
  door,
  controls,
  timezone,
  send,
  eventDoorHref,
}: CheckInPanelProps) {
  const titleId = useId();
  const queue = useCheckInQueue(send);
  // After a row's × the focus goes back to the code box, ready for the next person.
  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!door.open) return;
    const normalized = normalizeTicketCode(code);
    if (!normalized) {
      setError(
        `Enter the ticket code (1 to ${TICKET_CODE_MAX_LENGTH} characters).`,
      );
      return;
    }
    setError(undefined);
    const queued = queue.enqueue(normalized, door.context);
    setHint(
      queued === "duplicate"
        ? `${normalized} is already being checked. Its answer is below.`
        : null,
    );
    // Ready for the next person at once; the answer for this one arrives in its row.
    setCode("");
  }

  return (
    <section
      aria-labelledby={titleId}
      className="space-y-4 rounded-lg border border-line bg-surface p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 id={titleId} className="text-base font-semibold">
            {title}
          </h3>
          <p className="text-sm text-muted">{description}</p>
        </div>
        <Badge tone={door.open ? "success" : "neutral"}>
          {door.open ? "Check-in open" : "Check-in closed"}
        </Badge>
      </div>

      {controls}

      {door.open ? (
        <form
          onSubmit={submit}
          noValidate
          className="flex flex-wrap items-start gap-2.5"
        >
          <TextField
            ref={inputRef}
            label="Ticket code"
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
              if (error) setError(undefined);
            }}
            error={error}
            hint={hint ?? undefined}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={64}
            inputClassName="font-mono uppercase"
            className="min-w-60 flex-1"
          />
          {/* Never disabled while codes are being checked: the door must keep moving. */}
          <Button type="submit" className="mt-7">
            Check in
          </Button>
        </form>
      ) : (
        <Alert tone="info" title={door.title}>
          {door.detail}
        </Alert>
      )}

      {queue.pending > 1 && (
        <p className="text-sm text-muted">
          {queue.pending} codes are being checked, in order.
        </p>
      )}

      {queue.entries.length > 0 && (
        <ul
          aria-label="Check-in results"
          aria-live="polite"
          className="space-y-2"
        >
          {queue.entries.map((entry) => (
            <ResultRow
              key={entry.id}
              entry={entry}
              timezone={timezone}
              eventDoorHref={eventDoorHref}
              onRetry={() => queue.retry(entry.id)}
              onDismiss={queue.dismiss}
              onClosed={() => inputRef.current?.focus()}
            />
          ))}
        </ul>
      )}

      <p className="text-sm text-muted">{rules}</p>
    </section>
  );
}

type RowProps = {
  entry: CheckInEntry;
  timezone: string;
  eventDoorHref?: string;
  onRetry: () => void;
  /** Stable (the queue's): so a re-render does not restart a row's auto-close timer. */
  onDismiss: (id: number) => void;
  /** After the × was pressed: give the focus back to the code box. */
  onClosed: () => void;
};

/** One scanned code: waiting, being checked, or its answer. */
function ResultRow(props: RowProps) {
  const { entry } = props;
  if (entry.state !== "done" || !entry.outcome) {
    return (
      <li className="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm text-muted">
        {entry.state === "sending" ? (
          <Spinner />
        ) : (
          <Clock aria-hidden="true" className="size-4" />
        )}
        <span>
          <span className="font-mono">{entry.code}</span> ·{" "}
          {entry.state === "sending" ? "Checking…" : "Waiting…"}
        </span>
      </li>
    );
  }
  return <AnswerRow {...props} outcome={entry.outcome} />;
}

/**
 * A code's answer, read left to right: WHO (the name, big, with the ticket and the day or place
 * chip; just the typed code when the API named nobody), the ANSWER (what happened and what to
 * do), and WHEN (the check-in time the API gave, if any). On a phone the three stack. The ×
 * closes it; a green or amber row also closes by itself after a while, paused while the pointer
 * or the keyboard focus is on it so it never vanishes mid-read. Red rows and rows that need Try
 * again stay until closed.
 */
function AnswerRow({
  entry,
  outcome,
  timezone,
  eventDoorHref,
  onRetry,
  onDismiss,
  onClosed,
}: RowProps & { outcome: NonNullable<CheckInEntry["outcome"]> }) {
  const result = checkInResult(outcome, entry.context, timezone);
  const { box, icon: Icon } = TONES[result.tone];
  const ChipIcon = entry.context.door === "event" ? CalendarDays : MapPin;
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const paused = hovered || focused;
  const { id } = entry;

  useEffect(() => {
    if (result.autoCloseMs === null || paused) return;
    const timer = window.setTimeout(() => onDismiss(id), result.autoCloseMs);
    return () => window.clearTimeout(timer);
  }, [result.autoCloseMs, paused, onDismiss, id]);

  return (
    <li
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setFocused(false);
        }
      }}
      className={cn("relative rounded-md border px-4 py-3", box)}
    >
      <div className="grid gap-3 pr-8 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:items-center sm:gap-5">
        {/* WHO */}
        <div className="min-w-0 space-y-1">
          {result.person ? (
            <>
              <p className="truncate text-lg font-bold text-foreground">
                {result.person.name}
              </p>
              <p className="font-mono text-sm font-semibold tracking-wider text-foreground/80">
                {result.person.ticketCode}
              </p>
            </>
          ) : (
            <>
              <p className="text-xs text-muted">Ticket code</p>
              <p className="truncate font-mono text-lg font-bold tracking-wider text-foreground">
                {entry.code}
              </p>
            </>
          )}
          {result.chip && (
            <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2 py-0.5 text-xs font-semibold text-foreground">
              <ChipIcon aria-hidden="true" className="size-3.5" />
              <span className="sr-only">
                {entry.context.door === "event" ? "For " : "At "}
              </span>
              {result.chip}
            </span>
          )}
        </div>

        {/* THE ANSWER */}
        <div className="min-w-0 space-y-1 text-sm">
          <p className="flex items-center gap-1.5 text-base font-semibold">
            <Icon aria-hidden="true" className="size-5 flex-none" />
            {result.title}
          </p>
          <p className="text-foreground">{result.detail}</p>
          {result.needsEventDoor && eventDoorHref && (
            <Link
              href={eventDoorHref}
              className="inline-block font-semibold underline"
            >
              Check in at the event door
            </Link>
          )}
          {result.retryable && (
            <Button
              variant="secondary"
              onClick={onRetry}
              aria-label={`Try ${entry.code} again`}
              className="mt-1"
            >
              <RotateCcw aria-hidden="true" className="size-4" />
              Try again
            </Button>
          )}
        </div>

        {/* WHEN: only a time the API gave. */}
        {result.when && (
          <div className="text-foreground sm:text-right">
            <p className="text-xs text-muted">{result.when.label}</p>
            <p className="text-lg font-bold">{result.when.time}</p>
            <p className="text-sm">{result.when.date}</p>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          onDismiss(id);
          onClosed();
        }}
        aria-label={`Close the answer for ${entry.code}`}
        className="absolute right-2 top-2 rounded-md p-1 text-foreground/70 hover:bg-surface hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </li>
  );
}
