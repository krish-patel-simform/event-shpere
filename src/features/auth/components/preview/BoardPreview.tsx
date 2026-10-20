import { CircleAlert, ShieldCheck } from "lucide-react";
import { Badge, cn } from "@/src/core/ui";

type Tone = "brand" | "success" | "warning";
type Cell = { label: string; tone: Tone } | "drop" | null;

// Static sample content for the illustration only; nothing here comes from the API.
const HALLS = ["Hall A", "Hall B", "Lab 3"] as const;
const ROWS: readonly { time: string; cells: readonly [Cell, Cell, Cell] }[] = [
  {
    time: "10:00",
    cells: [
      { label: "Keynote: State of the Web", tone: "brand" },
      { label: "Scaling Next.js Applications", tone: "brand" },
      null,
    ],
  },
  {
    time: "11:30",
    cells: [
      { label: "Accessible Data Tables", tone: "brand" },
      "drop",
      { label: "Workshop: Zod APIs", tone: "success" },
    ],
  },
  {
    time: "14:00",
    cells: [
      { label: "Panel: Frontend Tooling", tone: "warning" },
      null,
      { label: "Workshop (cont.)", tone: "success" },
    ],
  },
];

const TONES: Record<Tone, string> = {
  brand: "bg-brand-soft text-brand-soft-foreground",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
};

/** Organizer signup illustration: a schedule board, plus the "every organisation is reviewed" note. */
export function BoardPreview() {
  return (
    <div className="space-y-5">
      <div aria-hidden="true" className="overflow-hidden rounded-xl bg-surface text-foreground shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <p className="text-sm font-semibold">Schedule board · Thu 4 Dec</p>
          <Badge tone="warning">2 unscheduled</Badge>
        </div>

        <div className="grid grid-cols-[2.5rem_repeat(3,minmax(0,1fr))] gap-x-2 gap-y-2 px-4 py-3 text-[11px]">
          <span />
          {HALLS.map((hall) => (
            <span key={hall} className="font-semibold uppercase tracking-wide text-muted">
              {hall}
            </span>
          ))}
          {ROWS.map((row) => (
            <div key={row.time} className="contents">
              <span className="pt-1 text-muted">{row.time}</span>
              {row.cells.map((cell, index) =>
                cell === null ? (
                  <span key={index} />
                ) : cell === "drop" ? (
                  <span
                    key={index}
                    className="rounded border border-dashed border-line px-2 py-1.5 font-semibold text-muted"
                  >
                    Drop a session here
                  </span>
                ) : (
                  <span
                    key={index}
                    className={cn("rounded px-2 py-1.5 font-semibold", TONES[cell.tone])}
                  >
                    {cell.label}
                  </span>
                ),
              )}
            </div>
          ))}
        </div>

        <p className="flex items-center gap-2 border-t border-line bg-surface-subtle px-4 py-2.5 text-xs text-muted">
          <CircleAlert className="size-3.5 shrink-0 text-warning" />
          Publish needs: event content, 2 sessions scheduled
        </p>
      </div>

      {/* Real information, not decoration: stays readable for screen readers. */}
      <div className="flex gap-3 rounded-lg border border-panel-line bg-panel-card p-4">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <div>
          <p className="text-sm font-semibold">Every organisation is reviewed</p>
          <p className="text-sm text-panel-muted">
            After you verify your email, our team checks your organisation details. Event tools
            unlock once you&apos;re approved.
          </p>
        </div>
      </div>
    </div>
  );
}
