import { Badge, Card } from "@/src/core/ui";
import type { UnavailableFeature } from "../types/profile";

/** Settings the design shows but the app cannot do yet, listed honestly instead of faked. */
export function UnavailableSettingsCard({
  features,
}: {
  features: readonly UnavailableFeature[];
}) {
  return (
    <Card
      title="Not available yet"
      description="These settings are planned. They do nothing for now."
    >
      <ul className="divide-y divide-line">
        {features.map((feature) => (
          <li
            key={feature.id}
            className="flex flex-wrap items-start justify-between gap-2 py-3 first:pt-0 last:pb-0"
          >
            <div className="min-w-0 flex-1 basis-60 text-sm">
              <p className="font-semibold">{feature.label}</p>
              <p className="text-muted">{feature.description}</p>
            </div>
            <Badge>Not available yet</Badge>
          </li>
        ))}
      </ul>
    </Card>
  );
}
