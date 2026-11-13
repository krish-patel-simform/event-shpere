import { Badge } from "./Badge";

/**
 * Where a part of a screen gets its data, so a reviewer can tell at a glance what already talks to
 * the API and what is still sample data:
 * - `live`: backed by an API endpoint that exists and is wired.
 * - `static`: sample data or a control with no API behind it yet.
 */
export type DataSource = "live" | "static";

const SOURCES: Record<
  DataSource,
  { label: string; tone: "success" | "warning"; hint: string }
> = {
  live: {
    label: "Live",
    tone: "success",
    hint: "Reads real data from the API",
  },
  static: {
    label: "Static",
    tone: "warning",
    hint: "Sample data: no API behind this yet",
  },
};

export function SourceBadge({
  source,
  className,
}: {
  source: DataSource;
  className?: string;
}) {
  const { label, tone, hint } = SOURCES[source];
  return (
    <Badge tone={tone} title={hint} className={className}>
      {label}
    </Badge>
  );
}
