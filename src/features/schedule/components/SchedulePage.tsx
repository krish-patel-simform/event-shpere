"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { Alert, Button, Card, Tabs, cn, tabId } from "@/src/core/ui";
import type { ScheduleItem, ScheduleView } from "../types/schedule.types";
import {
  defaultDayKey,
  findConflicts,
  groupByDay,
  itemsForView,
  toggleInSchedule,
} from "../utils/schedule-items";
import { buildIcs, downloadIcs, ICS_FILE_NAME } from "../utils/schedule-ics";
import { SCHEDULE_SAMPLE, SCHEDULE_SAMPLE_NOW } from "../utils/schedule.sample";
import { ScheduleRow } from "./ScheduleRow";
import {
  ScheduleEmpty,
  ScheduleError,
  ScheduleSkeleton,
} from "./ScheduleStates";

const VIEWS: readonly { key: ScheduleView; label: string }[] = [
  { key: "mine", label: "My items" },
  { key: "full", label: "Full programme" },
];

type SchedulePageProps = {
  items?: ScheduleItem[];
  /** The current time (ISO). A fixed default keeps the page and its tests deterministic. */
  now?: string;
  isLoading?: boolean;
  /** Why loading failed; shows the error state. */
  error?: string;
  onRetry?: () => void;
  /** Called with the .ics text when the person exports. Default: the browser downloads the file. */
  onExport?: (ics: string) => void;
};

/**
 * "My schedule": the sessions the person added, by day and in time order, with the full
 * programme one click away. Overlapping sessions are marked. UI only: sample data, and every
 * change stays in local state (nothing is sent).
 */
export function SchedulePage({
  items = SCHEDULE_SAMPLE,
  now = SCHEDULE_SAMPLE_NOW,
  isLoading = false,
  error,
  onRetry,
  onExport = downloadIcs,
}: SchedulePageProps) {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {isLoading ? (
        <>
          <PageTitle />
          <ScheduleSkeleton />
        </>
      ) : error ? (
        <>
          <PageTitle />
          <ScheduleError message={error} onRetry={onRetry} />
        </>
      ) : (
        <ScheduleWorkspace initialItems={items} now={now} onExport={onExport} />
      )}
    </div>
  );
}

function PageTitle() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">My schedule</h1>
      <p className="text-muted">
        The sessions you plan to attend, by day. Times are in UTC.
      </p>
    </div>
  );
}

const PANEL_ID = "schedule-day-panel";

function ScheduleWorkspace({
  initialItems,
  now,
  onExport,
}: {
  initialItems: ScheduleItem[];
  now: string;
  onExport: (ics: string) => void;
}) {
  const [items, setItems] = useState(initialItems);
  const [view, setView] = useState<ScheduleView>("mine");
  const [selectedDay, setSelectedDay] = useState<string>();
  const [exported, setExported] = useState<number | null>(null);

  const days = groupByDay(items);
  const conflicts = findConflicts(items);
  const inScheduleCount = items.filter(
    (item) => item.inSchedule && item.kind === "session",
  ).length;

  // How many items each day tab holds in the chosen view.
  const visible = itemsForView(items, view);
  const counts = Object.fromEntries(
    days.map((day) => [
      day.key,
      day.items.filter((item) => visible.includes(item)).length,
    ]),
  );
  const activeKey =
    days.find((day) => day.key === selectedDay)?.key ??
    defaultDayKey(days, now);
  const activeDay = days.find((day) => day.key === activeKey);
  const dayItems = activeDay
    ? activeDay.items.filter((item) => visible.includes(item))
    : [];

  const exportSchedule = () => {
    onExport(buildIcs(items, now));
    setExported(inScheduleCount);
  };

  // Every overlap, as one line each, for the warning on top.
  const clashingTitles = [...conflicts.keys()]
    .map((id) => items.find((item) => item.id === id)?.title)
    .filter(Boolean);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle />
        <div className="flex flex-wrap items-center gap-3">
          <div role="group" aria-label="View" className="flex">
            {VIEWS.map(({ key, label }, index) => (
              <button
                key={key}
                type="button"
                aria-pressed={view === key}
                onClick={() => setView(key)}
                className={cn(
                  "border border-field px-4 py-2.5 text-sm font-semibold",
                  index === 0 ? "rounded-l-md" : "-ml-px rounded-r-md",
                  view === key
                    ? "border-brand bg-brand-soft text-brand-soft-foreground"
                    : "bg-surface hover:bg-surface-subtle",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <Button
            variant="secondary"
            disabled={inScheduleCount === 0}
            onClick={exportSchedule}
          >
            <Download aria-hidden="true" className="size-4" />
            Export to calendar (.ics)
          </Button>
        </div>
      </div>

      {exported !== null && (
        <Alert tone="success" title="Calendar file ready">
          {exported} {exported === 1 ? "session" : "sessions"} saved to{" "}
          {ICS_FILE_NAME}. Import it into your calendar app.
        </Alert>
      )}

      {conflicts.size > 0 && (
        <Alert
          tone="warning"
          title={`${conflicts.size} ${conflicts.size === 1 ? "session overlaps" : "sessions overlap"} in your schedule`}
        >
          You cannot attend all of: {clashingTitles.join("; ")}. Remove one of
          each pair, or keep both and choose on the day.
        </Alert>
      )}

      {days.length === 0 ? (
        <p className="rounded-lg border border-line bg-surface px-5 py-12 text-center text-muted">
          No sessions are scheduled yet.
        </p>
      ) : view === "mine" && inScheduleCount === 0 ? (
        <ScheduleEmpty onBrowse={() => setView("full")} />
      ) : (
        <>
          <Tabs
            label="Event day"
            tabs={days.map((day) => ({ key: day.key, label: day.label }))}
            counts={counts}
            value={activeKey ?? ""}
            onChange={setSelectedDay}
            panelId={PANEL_ID}
          />
          {activeDay && (
            <div
              id={PANEL_ID}
              role="tabpanel"
              aria-labelledby={tabId(PANEL_ID, activeDay.key)}
            >
              <Card title={activeDay.heading} flush>
                {dayItems.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-muted">
                    Nothing in your schedule on this day. Switch to the full
                    programme to add sessions.
                  </p>
                ) : (
                  <ul>
                    {dayItems.map((item) => (
                      <ScheduleRow
                        key={item.id}
                        item={item}
                        clashesWith={conflicts.get(item.id) ?? []}
                        onToggle={(id) =>
                          setItems((current) => toggleInSchedule(current, id))
                        }
                      />
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          )}
        </>
      )}
    </>
  );
}
