import { useId, type ReactNode } from "react";
import { cn } from "./cn";

type CardProps = {
  /** The card's heading; also names the card for screen readers. */
  title?: string;
  /** One line of help under the heading. */
  description?: ReactNode;
  /** Goes on the right of the heading (a link or a button). */
  action?: ReactNode;
  /** No padding around the content, for a table that runs edge to edge. */
  flush?: boolean;
  className?: string;
  children: ReactNode;
};

/** A bordered box with an optional heading row: the building block of the detail pages. */
export function Card({
  title,
  description,
  action,
  flush = false,
  className,
  children,
}: CardProps) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={title ? titleId : undefined}
      className={cn(
        "overflow-hidden rounded-lg border border-line bg-surface",
        className,
      )}
    >
      {title && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 id={titleId} className="font-semibold">
              {title}
            </h2>
            {description && <p className="text-sm text-muted">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={flush ? undefined : "p-5"}>{children}</div>
    </section>
  );
}
