import { Check } from "lucide-react";
import { Badge, cn } from "@/src/core/ui";

export type ProgressStep = {
  title: string;
  description?: string;
  /** Small label next to the title, e.g. "Organizers only". */
  badge?: string;
  /** Dashed circle: a step that only some people take. */
  optional?: boolean;
  /** Where the user is. Leave out on an overview list where no step has started yet. */
  status?: "done" | "current" | "upcoming";
};

type ProgressTrackerProps = {
  steps: readonly ProgressStep[];
  /**
   * Shows the steps as a card with this heading and lines joining the circles ("YOUR PROGRESS").
   * Without it, a plain numbered list is shown.
   */
  heading?: string;
};

function StepCircle({ step, number }: { step: ProgressStep; number: number }) {
  return (
    <span
      className={cn(
        "relative z-10 grid size-7 shrink-0 place-items-center rounded-full border text-xs font-semibold",
        step.status === "done" && "border-panel-success bg-panel-success text-white",
        step.status === "current" && "border-panel-foreground bg-panel-foreground text-panel",
        step.status !== "done" && step.status !== "current" && "border-panel-muted text-panel-muted",
        step.optional && "border-dashed",
      )}
    >
      {step.status === "done" ? <Check aria-hidden="true" className="size-4" /> : number}
    </span>
  );
}

/** Numbered steps on the brand panel. Data-driven: pass the steps. */
export function ProgressTracker({ steps, heading }: ProgressTrackerProps) {
  const list = (
    <ol className={heading ? undefined : "space-y-5"}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        return (
          <li
            key={step.title}
            aria-current={step.status === "current" ? "step" : undefined}
            className={cn("relative flex gap-4", heading && !isLast && "pb-5")}
          >
            {/* Line down to the next circle: green once this step is done. */}
            {heading && !isLast && (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute bottom-0 left-3.5 top-7 w-px",
                  step.status === "done" ? "bg-panel-success" : "bg-panel-line",
                )}
              />
            )}
            <StepCircle step={step} number={index + 1} />
            <div>
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                {step.title}
                {step.badge && <Badge tone="onPanel">{step.badge}</Badge>}
              </p>
              {(step.description || step.status === "done") && (
                <p className="text-sm text-panel-muted">
                  {step.status === "done" && <span className="sr-only">Completed. </span>}
                  {step.description}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );

  if (!heading) return list;

  return (
    <section className="rounded-lg border border-panel-line bg-panel-card p-5">
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-panel-muted">
        {heading}
      </h3>
      {list}
    </section>
  );
}
