// The rules a session's own fields must satisfy together, as pure code: creating a session checks
// the body, editing one checks the saved session with the changes applied ("merged"). Both use
// this one function, so the two can never disagree.

export type SessionShape = {
  mode: "in_person" | "online" | "hybrid";
  hallId?: string | null;
  onlineUrl?: string | null;
  startAt?: Date | null;
  endAt?: Date | null;
};

export type SessionShapeIssue = {
  /** The field the message belongs to. */
  path: "hallId" | "onlineUrl" | "startAt" | "endAt";
  message: string;
};

/** What is wrong with these fields taken together; an empty list means they are fine. */
export function checkSessionShape(shape: SessionShape): SessionShapeIssue[] {
  const issues: SessionShapeIssue[] = [];
  const add = (path: SessionShapeIssue["path"], message: string) =>
    issues.push({ path, message });

  if (!shape.startAt) add("startAt", "Set the start time");
  if (!shape.endAt) add("endAt", "Set the end time");
  if (shape.startAt && shape.endAt && shape.endAt <= shape.startAt) {
    add("endAt", "End must be after the start");
  }

  const needsHall = shape.mode !== "online"; // in person and hybrid
  const needsLink = shape.mode !== "in_person"; // online and hybrid

  if (needsHall && !shape.hallId) add("hallId", "Choose a hall");
  if (!needsHall && shape.hallId)
    add("hallId", "An online session has no hall");
  if (needsLink && !shape.onlineUrl) add("onlineUrl", "Add the join link");
  if (!needsLink && shape.onlineUrl) {
    add("onlineUrl", "An in-person session has no join link");
  }

  return issues;
}

//* The hours of each day of an event

/** What the check needs of an event: its range, and the zone its times are read in. */
export type EventSpan = { startAt: Date; endAt: Date; timezone: string };

/** The calendar day ("2026-12-04") and the minutes since midnight of an instant, in a zone. */
function localDayAndMinute(
  date: Date,
  timeZone: string,
): { day: string; minute: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    day: `${get("year")}-${get("month")}-${get("day")}`,
    minute: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

/** "09:00" for 540 minutes since midnight. */
function clock(minute: number): string {
  const hours = String(Math.floor(minute / 60)).padStart(2, "0");
  return `${hours}:${String(minute % 60).padStart(2, "0")}`;
}

/**
 * Whether a session keeps to the event's daily hours; null when it does, else the reason.
 *
 * An event is a range from its start to its end, but its times of day also say when each day runs:
 * an event from 09:00 on 3 Dec to 17:00 on 5 Dec is open 09:00-17:00 on 3, 4 and 5 Dec. A session
 * on the middle day is inside the range at 18:00, yet after closing, so it must also start no
 * earlier than the opening time, end no later than the closing time, and finish the same day. The
 * range itself (before the start, after the end) is a separate check that comes first.
 *
 * An event that closes for the day at or before it opens (18:00 to 10:00 the next morning) runs
 * through the night: it has no daily hours, and only the range applies.
 */
export function checkEventHours(
  session: { startAt: Date; endAt: Date },
  event: EventSpan,
): string | null {
  const opens = localDayAndMinute(event.startAt, event.timezone);
  const closes = localDayAndMinute(event.endAt, event.timezone);
  if (closes.minute <= opens.minute) return null;

  const start = localDayAndMinute(session.startAt, event.timezone);
  const end = localDayAndMinute(session.endAt, event.timezone);
  const keepsToHours =
    start.day === end.day &&
    start.minute >= opens.minute &&
    end.minute <= closes.minute;
  return keepsToHours
    ? null
    : `Sessions must take place between ${clock(opens.minute)} and ${clock(closes.minute)} on each day of the event`;
}
