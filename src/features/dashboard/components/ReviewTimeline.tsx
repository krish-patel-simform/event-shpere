import { Check } from "lucide-react";
import { cn } from "@/src/core/ui";

export type ReviewStep = {
  title: string;
  /** A date, "In progress", "After approval"... */
  note: string;
  status: "done" | "current" | "upcoming";
};

/** The four stages of an organizer application, left to right (stacked on small screens). */
export function ReviewTimeline({ steps }: { steps: readonly ReviewStep[] }) {
  return (
    <ol className="grid gap-5 sm:grid-cols-4 sm:gap-4">
      {steps.map((step, index) => (
        <li
          key={step.title}
          aria-current={step.status === "current" ? "step" : undefined}
          className="flex items-start gap-3 sm:flex-col"
        >
          <span
            className={cn(
              "grid size-8 shrink-0 place-items-center rounded-full border-2 text-xs font-semibold",
              step.status === "done" && "border-success bg-success-soft text-success",
              step.status === "current" && "border-warning bg-warning-soft text-warning",
              step.status === "upcoming" && "border-line text-muted",
            )}
          >
            {step.status === "done" ? <Check aria-hidden="true" className="size-4" /> : index + 1}
          </span>
          <div>
            <p className="text-sm font-semibold">{step.title}</p>
            <p className={cn("text-sm", step.status === "current" ? "text-warning" : "text-muted")}>
              {step.status === "done" && <span className="sr-only">Completed. </span>}
              {step.note}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
