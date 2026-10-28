import { Badge, Card } from "@/src/core/ui";
import type { NotificationTopic } from "../types/profile";

/**
 * Which emails the person gets. The list is chosen by the page from a permission. The switches
 * are shown but disabled: saving preferences needs an API that does not exist yet.
 */
export function EmailNotificationsCard({
  email,
  topics,
}: {
  email: string;
  topics: readonly NotificationTopic[];
}) {
  return (
    <Card
      title="Email notifications"
      description={`Sent to ${email}`}
      action={<Badge>Not available yet</Badge>}
    >
      <p className="mb-3 text-sm text-muted">
        You cannot change these yet. They are shown so you know what is coming.
      </p>
      {topics.length === 0 ? (
        <p className="text-sm text-muted">There are no email topics for you.</p>
      ) : (
        <ul className="divide-y divide-line">
          {topics.map((topic) => (
            <li key={topic.id} className="flex items-start gap-3 py-3">
              <input
                type="checkbox"
                id={`topic-${topic.id}`}
                disabled
                className="mt-1 size-4"
              />
              <label htmlFor={`topic-${topic.id}`} className="flex-1 text-sm">
                <span className="block font-semibold">{topic.label}</span>
                <span className="block text-muted">{topic.description}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
