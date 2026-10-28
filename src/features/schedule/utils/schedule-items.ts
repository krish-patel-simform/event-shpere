import type {
  ScheduleDay,
  ScheduleItem,
  ScheduleView,
} from "../types/schedule.types";
import { dayKey, formatDayHeading, formatDayLabel } from "./schedule-time";

// The rules of the schedule screen as pure functions, tested without a component.

const time = (iso: string) => new Date(iso).getTime();

/** Earliest start first; the same start: the shorter first, then A-Z. Returns a new array. */
export function sortItems(items: readonly ScheduleItem[]): ScheduleItem[] {
  return [...items].sort(
    (a, b) =>
      time(a.startsAt) - time(b.startsAt) ||
      time(a.endsAt) - time(b.endsAt) ||
      a.title.localeCompare(b.title),
  );
}

/** One entry per UTC day that has an item, in date order, each with its items in time order. */
export function groupByDay(items: readonly ScheduleItem[]): ScheduleDay[] {
  const days = new Map<string, ScheduleDay>();
  for (const item of sortItems(items)) {
    const key = dayKey(item.startsAt);
    const day = days.get(key) ?? {
      key,
      label: formatDayLabel(item.startsAt),
      heading: formatDayHeading(item.startsAt),
      items: [],
    };
    day.items.push(item);
    days.set(key, day);
  }
  return [...days.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/** "My schedule" shows only what the person added; the full programme shows everything. */
export function itemsForView(
  items: readonly ScheduleItem[],
  view: ScheduleView,
): ScheduleItem[] {
  return view === "mine" ? items.filter((item) => item.inSchedule) : [...items];
}

/** Adds a session to the schedule or takes it out. A break cannot be added. Never mutates. */
export function toggleInSchedule(
  items: readonly ScheduleItem[],
  itemId: string,
): ScheduleItem[] {
  return items.map((item) =>
    item.id === itemId && item.kind === "session"
      ? { ...item, inSchedule: !item.inSchedule }
      : item,
  );
}

/** Two items clash when they share some time. One that starts as the other ends does not clash. */
export function overlaps(a: ScheduleItem, b: ScheduleItem): boolean {
  return time(a.startsAt) < time(b.endsAt) && time(b.startsAt) < time(a.endsAt);
}

/**
 * For each session in the schedule that overlaps another session in the schedule: the sessions it
 * clashes with. Sessions that are not in the schedule, and breaks, never count.
 */
export function findConflicts(
  items: readonly ScheduleItem[],
): Map<string, ScheduleItem[]> {
  const mine = sortItems(
    items.filter((item) => item.inSchedule && item.kind === "session"),
  );
  const conflicts = new Map<string, ScheduleItem[]>();
  for (const item of mine) {
    const clashing = mine.filter(
      (other) => other.id !== item.id && overlaps(item, other),
    );
    if (clashing.length > 0) conflicts.set(item.id, clashing);
  }
  return conflicts;
}

/**
 * The day tab to open first: today's if the programme has it, otherwise the next day with
 * something on, otherwise the last day. Undefined when there are no days.
 */
export function defaultDayKey(
  days: readonly ScheduleDay[],
  now: string,
): string | undefined {
  const today = dayKey(now);
  return (
    days.find((day) => day.key === today) ??
    days.find((day) => day.key > today) ??
    days.at(-1)
  )?.key;
}
