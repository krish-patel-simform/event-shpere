import { Fragment, type ReactNode } from "react";
import { cn } from "./cn";

export type DescriptionItem = { label: string; value: ReactNode };

/**
 * Label / value pairs ("Email · Verified"). Side by side from the `sm` breakpoint up, stacked on
 * a phone. A real <dl>, so a screen reader announces each value with its label.
 */
export function DescriptionList({
  items,
  labelWidth = "md",
  className,
}: {
  items: readonly DescriptionItem[];
  /** `sm` for a narrow side card, `md` for a card as wide as the page column. */
  labelWidth?: "sm" | "md";
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "grid gap-x-4 text-sm",
        labelWidth === "sm"
          ? "sm:grid-cols-[6rem_1fr]"
          : "sm:grid-cols-[9.5rem_1fr]",
        className,
      )}
    >
      {items.map((item) => (
        <Fragment key={item.label}>
          <dt className="mt-3 text-muted first:mt-0 sm:mt-0 sm:py-1">
            {item.label}
          </dt>
          <dd className="min-w-0 break-words font-medium sm:py-1">
            {item.value}
          </dd>
        </Fragment>
      ))}
    </dl>
  );
}
