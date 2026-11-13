import { Check } from "lucide-react";
import Link from "next/link";
import { cn } from "@/src/core/ui";
import {
  eventSessionEditHref,
  SESSION_STEPS,
  type SessionStep,
} from "../routes";

const STEP_META: Record<SessionStep, { label: string; detail: string }> = {
  details: { label: "Details", detail: "Time, hall, speakers, price" },
  content: { label: "Content", detail: "Description, links" },
  cover: { label: "Cover", detail: "Cover image" },
};

type SessionStepperProps = {
  eventId: string;
  /**
   * The saved session. Without it (a new session) the content and the cover have nothing to attach
   * to yet, so those two stay locked until the session is added; the details, with the speakers,
   * are on the add page (the API takes them in one request).
   */
  sessionId?: string;
  current: SessionStep;
  /** Steps that are filled in. A step left out has no tick (not done, or not known). */
  done?: Partial<Record<SessionStep, boolean>>;
};

/**
 * The three steps of the session form: Details (with the speakers), Content, Cover. The current one is part
 * of the URL (`?step=`), so each step is a link. A step that is filled in gets a tick. The same
 * stepper shows on the add page, with the later steps locked, so adding and editing look alike.
 */
export function SessionStepper({
  eventId,
  sessionId,
  current,
  done = {},
}: SessionStepperProps) {
  const isNew = sessionId === undefined;

  return (
    <nav aria-label="Session steps">
      <ol className="flex gap-2 overflow-x-auto sm:gap-3">
        {SESSION_STEPS.map((step, index) => {
          const { label, detail } = STEP_META[step];
          const isCurrent = step === current;
          const isDone = done[step] === true;
          // A new session: only the content and the cover wait for it to exist.
          const locked = isNew && (step === "content" || step === "cover");

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
                      (locked until the session is added)
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

          let item;
          if (!isNew) {
            item = (
              <Link
                href={eventSessionEditHref(eventId, sessionId, step)}
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  className,
                  !isCurrent && "hover:bg-surface-subtle",
                )}
              >
                {content}
              </Link>
            );
          } else {
            // The current step is plain text, the later ones are locked.
            item = (
              <span
                aria-current={isCurrent ? "step" : undefined}
                aria-disabled={locked || undefined}
                title={locked ? "Add the session first" : undefined}
                className={className}
              >
                {content}
              </span>
            );
          }

          return (
            <li key={step} className="flex min-w-36 flex-1">
              {item}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
