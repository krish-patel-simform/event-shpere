import { Check, CircleAlert } from "lucide-react";
import Link from "next/link";
import { Badge, Button, Card } from "@/src/core/ui";
import type {
  PublishReadiness,
  ReadinessItem,
} from "../../types/organizer-home";
import { EmptyState } from "../EmptyState";
import { ProgressBar } from "../ProgressBar";

function ChecklistItem({ item }: { item: ReadinessItem }) {
  return (
    <li className="flex items-start gap-3 border-b border-line py-2.5 text-sm last:border-b-0">
      {item.done ? (
        <Check
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 rounded-full bg-success p-0.5 text-surface"
        />
      ) : (
        <CircleAlert
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 text-warning"
        />
      )}
      <div className="min-w-0 flex-1">
        <p>
          <span className="sr-only">{item.done ? "Done: " : "Missing: "}</span>
          {item.label}
        </p>
        {!item.done && item.detail && (
          <p className="text-xs text-muted">{item.detail}</p>
        )}
      </div>
      {!item.done && item.action && (
        <Link
          href={item.action.href}
          className="font-semibold text-link hover:underline"
        >
          {item.action.label}
        </Link>
      )}
    </li>
  );
}

/** What the draft closest to launch still needs before it can be published. */
export function PublishReadinessCard({
  readiness,
}: {
  readiness: PublishReadiness | null;
}) {
  if (!readiness) {
    return (
      <Card title="Ready to publish?" flush>
        <EmptyState>No drafts waiting to be published.</EmptyState>
      </Card>
    );
  }

  const done = readiness.items.filter((item) => item.done).length;
  const missing = readiness.items.filter((item) => !item.done);

  return (
    <Card
      title="Ready to publish?"
      description={
        <>
          {readiness.eventTitle} <Badge>Draft</Badge>
        </>
      }
      action={
        <span className="text-sm font-semibold">
          {done} / {readiness.items.length}
        </span>
      }
    >
      <ProgressBar
        value={done}
        max={readiness.items.length}
        label="Publishing checklist"
        tone="success"
      />
      <ul className="mb-3 mt-1">
        {readiness.items.map((item) => (
          <ChecklistItem key={item.label} item={item} />
        ))}
      </ul>
      {/* TODO(API): publishing needs the event publish endpoint; the button does nothing yet. */}
      <Button fullWidth disabled={missing.length > 0}>
        Publish event
      </Button>
      {missing.length > 0 && (
        <p className="mt-1.5 text-center text-xs text-muted">
          Missing: {missing.map((item) => item.label).join(", ")}
        </p>
      )}
    </Card>
  );
}
