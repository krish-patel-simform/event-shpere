const DATE_PARTS = { day: "numeric", year: "numeric", timeZone: "UTC" } as const;

/**
 * "20 Oct 2026" or, with time, "20 October 2026, 11:24". Always UTC and en-GB, so the server and
 * the browser print the same text (a local time zone would differ and break hydration). Date and
 * time are formatted separately and joined here, because Intl's own joiner varies ("at", ",").
 */
export function formatDate(iso: string, style: "short" | "long" = "short"): string {
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat("en-GB", {
    ...DATE_PARTS,
    month: style === "short" ? "short" : "long",
  }).format(date);
  if (style === "short") return day;

  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date);
  return `${day}, ${time}`;
}
