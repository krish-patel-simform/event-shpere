import { Check } from "lucide-react";
import { Badge } from "@/src/core/ui";

// Static sample content for the illustration only; nothing here comes from the API.
const TILES = [
  { label: "Session booking", text: "Register for the event first, then book sessions" },
  { label: "Clash check", text: "We warn you if two sessions overlap" },
] as const;

/** User signup illustration: an event card and two short feature tiles. */
export function EventPreview() {
  return (
    <div aria-hidden="true" className="space-y-3">
      <div className="overflow-hidden rounded-xl bg-surface text-foreground shadow-xl">
        <div className="h-16 bg-brand-soft p-3">
          <Badge tone="surface">Published</Badge>
        </div>
        <div className="space-y-3 p-4">
          <div>
            <p className="font-semibold">Product Engineering Summit 2026</p>
            <p className="text-xs text-muted">Wed 3 – Fri 5 Dec · Pune · 18 sessions in 4 halls</p>
          </div>
          <div className="flex items-center justify-between border-t border-line pt-3">
            <div>
              <p className="text-sm font-semibold">Free</p>
              <p className="text-xs text-muted">120 seats left</p>
            </div>
            <Badge tone="success">
              <Check aria-hidden="true" className="size-3" />
              Registered
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {TILES.map((tile) => (
          <div key={tile.label} className="rounded-lg border border-panel-line bg-panel-card p-3">
            <p className="text-xs text-panel-muted">{tile.label}</p>
            <p className="text-sm font-semibold">{tile.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
