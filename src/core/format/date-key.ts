// A calendar day written as text, "2026-12-12": what a date input holds and what the forms keep.
// These work on the day itself (year, month, day), never on an instant, so the browser's time zone
// can not move the day.

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "2026-12-12" for a calendar day, read from the Date's own local year, month and day. */
export function toDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * The calendar day as a Date at local midnight, or null when the text is not a real day
 * ("2026-02-31" and "tomorrow" are both null).
 */
export function fromDateKey(key: string): Date | null {
  const match = DATE_KEY.exec(key);
  if (!match) return null;
  const [year, month, day] = [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
  ];
  const date = new Date(year, month - 1, day);
  const real =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;
  return real ? date : null;
}

/**
 * The same day some years later. 29 February lands on 28 February in a year without one, not on
 * 1 March. Null when the text is not a real day.
 */
export function addYearsToDateKey(key: string, years: number): string | null {
  const date = fromDateKey(key);
  if (!date) return null;
  const year = date.getFullYear() + years;
  const month = date.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  return toDateKey(new Date(year, month, Math.min(date.getDate(), lastDay)));
}
