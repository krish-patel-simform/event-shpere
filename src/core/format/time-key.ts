// A time of day written as text, "09:30" (24 hours): what a time input holds and what the forms
// keep. Minutes are counted since midnight.

const TIME_KEY = /^(\d{2}):(\d{2})$/;

/** Minutes since midnight for "09:30" (570), or null when the text is not a time of day. */
export function toMinutes(time: string): number | null {
  const match = TIME_KEY.exec(time);
  if (!match) return null;
  const [hours, minutes] = [Number(match[1]), Number(match[2])];
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
}

/** "09:30" for 570 minutes since midnight. */
export function fromMinutes(minutes: number): string {
  const hours = String(Math.floor(minutes / 60)).padStart(2, "0");
  const rest = String(minutes % 60).padStart(2, "0");
  return `${hours}:${rest}`;
}

/** "9:30 AM" for "09:30": how a time is read out in the list of times. */
export function formatTime12(time: string): string {
  const minutes = toMinutes(time);
  if (minutes === null) return time;
  const hours = Math.floor(minutes / 60);
  const clock = hours % 12 === 0 ? 12 : hours % 12;
  const suffix = hours < 12 ? "AM" : "PM";
  return `${clock}:${String(minutes % 60).padStart(2, "0")} ${suffix}`;
}
