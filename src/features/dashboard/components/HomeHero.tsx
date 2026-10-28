import Link from "next/link";
import { useId, type ReactNode } from "react";
import { buttonStyles, cn } from "@/src/core/ui";
import { getCountdown, plural } from "../utils/home-format";

export type HeroAction = {
  label: string;
  href: string;
  /** "solid" is the one main action; "outline" are the others. */
  style: "solid" | "outline";
};

export type HeroCountdown = {
  /** ISO date-time the timer counts down to. */
  startsAt: string;
  /** ISO date-time "now". */
  now: string;
  /** Finishes the sentence the timer reads out: "until your next session". */
  label: string;
};

const OUTLINE_ACTION =
  "inline-flex items-center justify-center rounded-md border border-panel-muted px-4 py-2.5 text-sm font-semibold text-panel-foreground transition-colors hover:bg-panel-card";

function CountdownTimer({ startsAt, now, label }: HeroCountdown) {
  const { days, hours, minutes, started } = getCountdown(startsAt, now);
  if (started) return null;

  const units = [
    { value: days, unit: "day" },
    { value: hours, unit: "hour" },
    { value: minutes, unit: "min" },
  ] as const;

  return (
    <div>
      <p className="mb-2 text-xs font-semibold tracking-wide text-panel-muted">
        STARTS IN
      </p>
      <div
        role="timer"
        aria-label={`${plural(days, "day")}, ${plural(hours, "hour")}, ${plural(minutes, "minute")} ${label}`}
        className="flex gap-2"
      >
        {units.map(({ value, unit }) => (
          <div
            key={unit}
            aria-hidden="true"
            className="flex min-w-16 flex-col items-center rounded-md border border-panel-line bg-panel-card p-2"
          >
            <b className="font-mono text-xl leading-tight">{value}</b>
            <span className="text-[11px] text-panel-muted">{unit}s</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The navy banner at the top of the attendee and speaker home: what is coming next, the main
 * links, and a countdown. With no countdown (nothing coming up) it is just a greeting.
 */
export function HomeHero({
  eyebrow,
  heading,
  summary,
  actions,
  countdown,
  aside,
}: {
  eyebrow: string;
  heading: string;
  summary: ReactNode;
  actions: readonly HeroAction[];
  countdown?: HeroCountdown;
  /** Extra block under the timer. */
  aside?: ReactNode;
}) {
  const headingId = useId();
  // No timer once the event has started.
  const timer =
    countdown && !getCountdown(countdown.startsAt, countdown.now).started
      ? countdown
      : null;

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-wrap items-center justify-between gap-7 rounded-xl bg-panel px-6 py-7 text-panel-foreground sm:px-8"
    >
      <div className="min-w-0 flex-1 basis-96">
        <p className="text-sm text-panel-muted">{eyebrow}</p>
        <h1 id={headingId} className="mb-1.5 mt-1 text-2xl font-semibold">
          {heading}
        </h1>
        <p className="mb-5 text-panel-muted">{summary}</p>
        <div className="flex flex-wrap gap-2.5">
          {actions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className={cn(
                action.style === "solid"
                  ? buttonStyles({ variant: "secondary" })
                  : OUTLINE_ACTION,
              )}
            >
              {action.label}
            </Link>
          ))}
        </div>
      </div>
      {(timer || aside) && (
        <div className="flex flex-col gap-4">
          {timer && <CountdownTimer {...timer} />}
          {aside}
        </div>
      )}
    </section>
  );
}
