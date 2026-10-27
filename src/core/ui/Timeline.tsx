import type { ReactNode } from "react";
import { cn } from "./cn";

export type TimelineItem = {
  title: ReactNode;
  /** A date, or a sentence of context, under the title. */
  detail?: ReactNode;
  /** A step that already happened is a filled dot; one still to come is an empty dot. */
  done?: boolean;
};

/**
 * A vertical list of steps, newest first, joined by a line. `strongTitles` makes each title
 * semibold, for steps that are headings; leave it off for a sentence with its own bold parts.
 */
export function Timeline({
  items,
  strongTitles = false,
}: {
  items: readonly TimelineItem[];
  strongTitles?: boolean;
}) {
  return (
    <ol className="relative space-y-4 pl-6 before:absolute before:bottom-1.5 before:left-[5px] before:top-1.5 before:w-0.5 before:bg-line">
      {items.map((item, index) => (
        <li key={index} className="relative">
          <span
            aria-hidden="true"
            className={cn(
              "absolute -left-6 top-1.5 size-3 rounded-full border-2",
              item.done ? "border-brand bg-brand" : "border-field bg-surface",
            )}
          />
          <div className={strongTitles ? "font-semibold" : undefined}>
            {item.title}
          </div>
          {item.detail && (
            <div className="text-sm text-muted">{item.detail}</div>
          )}
        </li>
      ))}
    </ol>
  );
}
