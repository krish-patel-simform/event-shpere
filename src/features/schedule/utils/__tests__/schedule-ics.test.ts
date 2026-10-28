import {
  allItems,
  coffee,
  NOW,
  talkA,
  talkB,
} from "../../__fixtures__/schedule";
import { buildIcs } from "../schedule-ics";
import { durationMinutes, formatClock } from "../schedule-time";

describe("buildIcs", () => {
  const ics = buildIcs(allItems, NOW);

  it("is a calendar with CRLF line ends", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).not.toMatch(/[^\r]\n/);
  });

  it("has one event per session in the schedule, in time order, and no breaks", () => {
    const summaries = ics.match(/^SUMMARY:.*$/gm);
    expect(summaries).toEqual([
      "SUMMARY:Opening keynote",
      "SUMMARY:Talk A",
      "SUMMARY:Talk B",
    ]);
    expect(ics).not.toContain(coffee.title);
  });

  it("writes UTC times, a stable id and the stamp", () => {
    expect(ics).toContain("UID:talk-a@eventsphere");
    expect(ics).toContain("DTSTART:20261204T100000Z");
    expect(ics).toContain("DTEND:20261204T104500Z");
    expect(ics).toContain("DTSTAMP:20261204T080000Z");
  });

  it("writes the place and who speaks", () => {
    expect(ics).toContain("LOCATION:Hall B");
    expect(ics).toContain("DESCRIPTION:Talk");
  });

  it("escapes commas, semicolons and line breaks", () => {
    const tricky = { ...talkA, title: "A, B; C\nD", location: null };
    expect(buildIcs([tricky], NOW)).toContain("SUMMARY:A\\, B\\; C\\nD");
  });

  it("folds long lines at 75 characters", () => {
    const long = { ...talkB, title: "x".repeat(200) };
    const lines = buildIcs([long], NOW).split("\r\n");
    expect(lines.every((line) => line.length <= 75)).toBe(true);
    expect(lines.some((line) => line.startsWith(" x"))).toBe(true);
  });

  it("is an empty calendar when nothing is in the schedule", () => {
    expect(buildIcs([coffee], NOW)).not.toContain("BEGIN:VEVENT");
  });
});

describe("schedule time helpers", () => {
  it("formatClock prints 24 hour UTC time", () => {
    expect(formatClock("2026-12-04T09:05:00.000Z")).toBe("09:05");
  });

  it("durationMinutes counts minutes and never goes below 0", () => {
    expect(durationMinutes(talkA.startsAt, talkA.endsAt)).toBe(45);
    expect(durationMinutes(talkA.endsAt, talkA.startsAt)).toBe(0);
  });
});
