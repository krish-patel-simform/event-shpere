import Link from "next/link";
import { Badge, Card } from "@/src/core/ui";
import type { AttentionItem, AttentionKind } from "../../types/organizer-home";
import { EmptyState } from "../EmptyState";

const KINDS: Record<
  AttentionKind,
  { label: string; tone: "warning" | "brand" | "danger" | "neutral" }
> = {
  almost_full: { label: "Almost full", tone: "warning" },
  invite: { label: "Invite", tone: "brand" },
  content: { label: "Content", tone: "danger" },
  polls: { label: "Polls", tone: "neutral" },
};

/** Things that need the organizer today: full sessions, missing accounts or content, polls. */
export function NeedsAttentionCard({
  items,
}: {
  items: readonly AttentionItem[];
}) {
  return (
    <Card title="Needs attention" flush={items.length === 0}>
      {items.length === 0 ? (
        <EmptyState>Nothing needs your attention right now.</EmptyState>
      ) : (
        <ul>
          {items.map((item) => {
            const kind = KINDS[item.kind];
            return (
              <li
                key={item.id}
                className="flex items-start gap-3 border-b border-line py-3 first:pt-0 last:border-b-0 last:pb-0"
              >
                <Badge tone={kind.tone}>{kind.label}</Badge>
                <p className="flex-1 text-sm">
                  {item.subject && <strong>{item.subject} </strong>}
                  {item.message}
                  {item.action && (
                    <>
                      {" "}
                      <Link
                        href={item.action.href}
                        className="font-semibold text-link hover:underline"
                      >
                        {item.action.label}
                      </Link>
                    </>
                  )}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
