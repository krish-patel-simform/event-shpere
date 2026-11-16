import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { formatTime12 } from "@/src/core/format/time-key";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** 1 → "1st", 22 → "22nd", 13 → "13th": how the calendar names its day buttons. */
function ordinal(day: number): string {
  const suffixes = ["th", "st", "nd", "rd"];
  const rest = day % 100;
  return `${day}${suffixes[(rest - 20) % 10] ?? suffixes[rest] ?? suffixes[0]}`;
}

/** The name of a day's button in the open calendar, as a pattern: "December 12th, 2026". */
export function dayButtonName(key: string): RegExp {
  const [year, month, day] = key.split("-").map(Number);
  return new RegExp(`${MONTHS[month - 1]} ${ordinal(day)}, ${year}`);
}

/**
 * Chooses a day in the date picker named `label`, the way a person does: open the calendar, pick
 * the year and the month, click the day. `key` is "2026-12-12". A day the calendar disables can
 * not be clicked, so this throws for it.
 */
export async function chooseDate(label: string, key: string) {
  const user = userEvent.setup();
  const [year, month] = key.split("-").map(Number);
  const monthName = MONTHS[month - 1];

  await user.click(
    screen.getByRole("button", { name: new RegExp(`^${label}`) }),
  );
  const calendar = within(screen.getByRole("dialog"));
  await user.selectOptions(
    calendar.getByRole("combobox", { name: "Choose the Year" }),
    String(year),
  );
  await user.selectOptions(
    calendar.getByRole("combobox", { name: "Choose the Month" }),
    monthName,
  );
  await user.click(calendar.getByRole("button", { name: dayButtonName(key) }));
}

/** Chooses a time ("08:00") in the time picker named `label`: open the list, click the time. */
export async function chooseTime(label: string, time: string) {
  const user = userEvent.setup();

  await user.click(
    screen.getByRole("combobox", { name: new RegExp(`^${label}`) }),
  );
  await user.click(screen.getByRole("option", { name: formatTime12(time) }));
}

/** The date or time picker with this label, whichever it is (its name ends in "date" or "time"). */
export async function setValue(label: string, value: string) {
  if (label.toLowerCase().endsWith("date")) await chooseDate(label, value);
  else await chooseTime(label, value);
}
