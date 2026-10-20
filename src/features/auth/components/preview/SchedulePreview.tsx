import { Check } from "lucide-react";
import { Badge } from "@/src/core/ui";

// Static sample content for the illustration only; nothing here comes from the API.
const SESSIONS = [
  { time: "10:00", title: "Scaling Next.js Applications", meta: "Hall B · Talk", status: "Registered", tone: "success" },
  { time: "11:30", title: "Designing Accessible Data Tables", meta: "Hall A · Talk", status: "8 of 30 left", tone: "warning" },
  { time: "14:00", title: "Type-safe APIs with Zod", meta: "Lab 3 · Workshop", status: "Full", tone: "neutral" },
] as const;

const POLL_OPTIONS = [
  { label: "Server-side rendering", percent: 41 },
  { label: "Static generation", percent: 32 },
] as const;

/** Login screen illustration: a schedule card with a live poll and a confirmation toast. */
export function SchedulePreview() {
  return (
    <div aria-hidden="true" className="relative pb-14">
      <div className="overflow-hidden rounded-xl bg-surface text-foreground shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <p className="text-xs text-muted">My schedule</p>
            <p className="font-semibold">Thursday, 4 December</p>
          </div>
          <Badge tone="brand">3 sessions</Badge>
        </div>

        <ul className="divide-y divide-line">
          {SESSIONS.map((session) => (
            <li key={session.time} className="flex items-center gap-4 px-5 py-3">
              <span className="w-11 text-sm font-semibold">{session.time}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{session.title}</p>
                <p className="text-xs text-muted">{session.meta}</p>
              </div>
              <Badge tone={session.tone}>{session.status}</Badge>
            </li>
          ))}
        </ul>

        <div className="space-y-3 bg-surface-subtle px-5 py-4">
          <p className="flex items-center gap-2 text-xs font-semibold text-success">
            <span className="size-1.5 rounded-full bg-success" />
            LIVE POLL · 186 votes
          </p>
          <p className="text-sm font-semibold">Which rendering strategy do you use most?</p>
          {POLL_OPTIONS.map((option) => (
            <div key={option.label} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>{option.label}</span>
                <span className="font-semibold">{option.percent}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${option.percent}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-0 right-0 flex max-w-72 items-start gap-3 rounded-lg bg-surface p-3 text-foreground shadow-xl">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-success-soft text-success">
          <Check className="size-4" />
        </span>
        <div>
          <p className="text-sm font-semibold">Registration confirmed</p>
          <p className="text-xs text-muted">Product Engineering Summit 2026 · just now</p>
        </div>
      </div>
    </div>
  );
}
