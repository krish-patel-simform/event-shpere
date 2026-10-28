import type { ScheduleItem } from "../types/schedule.types";
import { sortItems } from "./schedule-items";

export const ICS_FILE_NAME = "eventsphere-my-schedule.ics";

/** "2026-12-04T10:00:00.000Z" -> "20261204T100000Z" (iCalendar UTC time). */
function icsTime(iso: string): string {
  return new Date(iso)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

/** iCalendar text escapes: backslash, semicolon, comma and line breaks. */
function escapeText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Lines longer than 75 characters continue on the next line, which starts with a space. */
function fold(line: string): string {
  const chunks: string[] = [];
  let rest = line;
  while (rest.length > 75) {
    chunks.push(rest.slice(0, 75));
    rest = ` ${rest.slice(75)}`;
  }
  chunks.push(rest);
  return chunks.join("\r\n");
}

/**
 * The sessions in the schedule as an iCalendar (.ics) file, ready to import into any calendar
 * app. Times are UTC. Breaks and sessions that are not in the schedule are left out.
 */
export function buildIcs(items: readonly ScheduleItem[], now: string): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EventSphere//My schedule//EN",
    "CALSCALE:GREGORIAN",
  ];
  for (const item of sortItems(
    items.filter((i) => i.inSchedule && i.kind === "session"),
  )) {
    const description = [
      item.format,
      item.speakers.length > 0 ? `with ${item.speakers.join(", ")}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${item.id}@eventsphere`,
      `DTSTAMP:${icsTime(now)}`,
      `DTSTART:${icsTime(item.startsAt)}`,
      `DTEND:${icsTime(item.endsAt)}`,
      `SUMMARY:${escapeText(item.title)}`,
    );
    if (item.location) lines.push(`LOCATION:${escapeText(item.location)}`);
    if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return `${lines.map(fold).join("\r\n")}\r\n`;
}

/** Saves the text as a file through the browser. Browser only; not used in tests. */
export function downloadIcs(ics: string, fileName: string = ICS_FILE_NAME) {
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
