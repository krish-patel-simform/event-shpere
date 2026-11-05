import { Check } from "lucide-react";
import Link from "next/link";
import { cn } from "@/src/core/ui";
import { eventEditHref, EVENT_STEPS, type EventStep } from "../routes";

const STEP_META: Record<EventStep, { label: string; detail: string }> = {
  details: { label: "Details", detail: "Dates, venue, tickets" },
  content: { label: "Content", detail: "Description, FAQs, SEO" },
  media: { label: "Media", detail: "Cover and gallery" },
};

type EventStepperProps = {
  /** The saved event. Without it (a new event) only the first step can be opened. */
  eventId?: string;
  current: EventStep;
  /** Steps that are filled in. A step left out has no tick (not done, or not known). */
  done?: Partial<Record<EventStep, boolean>>;
};

/**
 * The three steps of the event form: Details, Content, Media. The current one is part of the URL
 * (`?step=`), so each step is a link. A new event has nothing to attach the page content or the
 * images to yet, so those two stay locked until the first step has created it.
 */
export function EventStepper({
  eventId,
  current,
  done = {},
}: EventStepperProps) {
  return (
    <nav aria-label="Event steps">
      <ol className="flex gap-2 overflow-x-auto sm:gap-3">
        {EVENT_STEPS.map((step, index) => {
          const { label, detail } = STEP_META[step];
          const isCurrent = step === current;
          const isDone = done[step] === true;
          const locked = eventId === undefined && step !== "details";

          const content = (
            <>
              <span
                aria-hidden="true"
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full border text-xs font-semibold",
                  isCurrent && "border-brand bg-brand text-brand-foreground",
                  !isCurrent &&
                    isDone &&
                    "border-success bg-success-soft text-success",
                  !isCurrent && !isDone && "border-field text-muted",
                )}
              >
                {isDone && !isCurrent ? (
                  <Check className="size-4" />
                ) : (
                  index + 1
                )}
              </span>
              <span className="min-w-0 text-left">
                <span className="block text-sm font-semibold">
                  {label}
                  {isDone && <span className="sr-only"> (done)</span>}
                  {locked && (
                    <span className="sr-only">
                      {" "}
                      (locked until the event is created)
                    </span>
                  )}
                </span>
                <span className="hidden text-xs text-muted sm:block">
                  {detail}
                </span>
              </span>
            </>
          );

          const className = cn(
            "flex min-w-0 flex-1 items-center gap-3 rounded-lg border px-3 py-2.5",
            isCurrent ? "border-brand bg-surface" : "border-line bg-surface",
            locked && "cursor-not-allowed text-muted",
          );

          return (
            <li key={step} className="flex min-w-36 flex-1">
              {eventId === undefined ? (
                // No saved event yet: nothing to link to. The current step is plain text, the
                // later ones are locked.
                <span
                  aria-current={isCurrent ? "step" : undefined}
                  aria-disabled={locked || undefined}
                  title={locked ? "Create the event first" : undefined}
                  className={className}
                >
                  {content}
                </span>
              ) : (
                <Link
                  href={eventEditHref(eventId, step)}
                  aria-current={isCurrent ? "step" : undefined}
                  className={cn(
                    className,
                    !isCurrent && "hover:bg-surface-subtle",
                  )}
                >
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
