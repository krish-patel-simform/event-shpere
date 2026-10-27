"use client";

import { useRef, type ComponentProps, type MouseEvent } from "react";
import { cn } from "./cn";

/** What a click on must keep doing its own job instead of opening the row. */
const INTERACTIVE =
  'a, button, input, select, textarea, label, dialog, [role="menu"], [role="menuitem"]';

/**
 * A table row that opens its detail page when you click anywhere on it. The row's own link
 * (mark it `data-row-link`) stays the real, keyboard and screen-reader way in; the click only
 * forwards to it, so client-side navigation and the URL work exactly as for a click on the link.
 * Clicks on links, buttons and form controls inside the row, clicks that bubble up from a portal
 * (the action menu is drawn in `document.body`) and a text selection do not open the row.
 */
export function ClickableRow({
  className,
  onClick,
  ...props
}: ComponentProps<"tr">) {
  const row = useRef<HTMLTableRowElement>(null);

  function open(event: MouseEvent<HTMLTableRowElement>) {
    onClick?.(event);
    if (event.defaultPrevented) return;

    const target = event.target as Element;
    // React events bubble through portals; only a click really inside the row counts.
    if (!event.currentTarget.contains(target)) return;
    if (target.closest(INTERACTIVE)) return;
    if (window.getSelection()?.toString()) return;

    row.current?.querySelector<HTMLAnchorElement>("a[data-row-link]")?.click();
  }

  return (
    <tr
      ref={row}
      onClick={open}
      className={cn("cursor-pointer hover:bg-surface-subtle", className)}
      {...props}
    />
  );
}
