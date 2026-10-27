// A fixed locale (like formatDate), so the server and the browser print the same text.
const COUNT = new Intl.NumberFormat("en-GB");

/** 4812 → "4,812". */
export function formatCount(value: number): string {
  return COUNT.format(value);
}
