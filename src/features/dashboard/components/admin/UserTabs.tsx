"use client";

import { useRef, type KeyboardEvent } from "react";
import { Badge, cn } from "@/src/core/ui";
import type { UserTabKey } from "../../types/admin-users";
import { formatCount } from "../../utils/format-number";

type UserTab = { key: UserTabKey; label: string };

/** The id of a tab's button, so the panel can say it is labelled by the selected tab. */
export const userTabId = (panelId: string, key: UserTabKey) =>
  `${panelId}-tab-${key}`;

/**
 * Filter tabs with a count each. Follows the ARIA tabs pattern: only the selected tab is in the
 * Tab order, Left/Right/Home/End move between tabs and select them.
 */
export function UserTabs({
  tabs,
  counts,
  value,
  onChange,
  panelId,
}: {
  tabs: readonly UserTab[];
  counts: Record<UserTabKey, number>;
  value: UserTabKey;
  onChange: (key: UserTabKey) => void;
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
      aria-label="Filter users"
      className="flex gap-6 overflow-x-auto border-b border-line"
    >
      {tabs.map((tab, index) => {
        const selected = tab.key === value;
        return (
          <button
            key={tab.key}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            type="button"
            role="tab"
            id={userTabId(panelId, tab.key)}
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
            <Badge
              tone={
                tab.key === "suspended"
                  ? "danger"
                  : selected
                    ? "brand"
                    : "neutral"
              }
            >
              {formatCount(counts[tab.key])}
            </Badge>
          </button>
        );
      })}
    </div>
  );
}
