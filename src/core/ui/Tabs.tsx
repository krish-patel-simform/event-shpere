"use client";

import { useRef, type ComponentProps, type KeyboardEvent } from "react";
import { formatCount } from "../format/format-number";
import { Badge } from "./Badge";
import { cn } from "./cn";

export type Tab<Key extends string> = {
  key: Key;
  label: string;
  /** Colour of the count badge when this tab is not selected. */
  tone?: ComponentProps<typeof Badge>["tone"];
};

/** The id of a tab's button, so the panel can say it is labelled by the selected tab. */
export const tabId = (panelId: string, key: string) => `${panelId}-tab-${key}`;

/**
 * Filter tabs, with a count on a tab when one is known. Follows the ARIA tabs pattern: only the
 * selected tab is in the Tab order, Left/Right/Home/End move between tabs and select them.
 */
export function Tabs<Key extends string>({
  label,
  tabs,
  counts = {},
  value,
  onChange,
  panelId,
}: {
  /** What the tabs filter, for screen readers ("Filter users"). */
  label: string;
  tabs: readonly Tab<Key>[];
  /** How many items each tab holds. A tab without an entry shows no count. */
  counts?: Partial<Record<Key, number>>;
  value: Key;
  onChange: (key: Key) => void;
  /** The id of the element that shows the selected tab's content. */
  panelId: string;
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: KeyboardEvent, index: number) {
    const last = tabs.length - 1;
    const next =
      event.key === "ArrowRight"
        ? index === last
          ? 0
          : index + 1
        : event.key === "ArrowLeft"
          ? index === 0
            ? last
            : index - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    onChange(tabs[next].key);
    buttons.current[next]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex gap-6 overflow-x-auto border-b border-line"
    >
      {tabs.map((tab, index) => {
        const selected = tab.key === value;
        const count = counts[tab.key];
        return (
          <button
            key={tab.key}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            type="button"
            role="tab"
            id={tabId(panelId, tab.key)}
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.key)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              "inline-flex h-11 shrink-0 items-center gap-2 border-b-2 px-1 text-sm",
              selected
                ? "border-brand font-semibold text-link"
                : "border-transparent font-medium text-muted hover:text-foreground",
            )}
          >
            {tab.label}
            {count !== undefined && (
              <Badge tone={selected ? "brand" : (tab.tone ?? "neutral")}>
                {formatCount(count)}
              </Badge>
            )}
          </button>
        );
      })}
    </div>
  );
}
