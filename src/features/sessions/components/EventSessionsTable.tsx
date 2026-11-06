import {
  FileText,
  Image as ImageIcon,
  Pencil,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import {
  Badge,
  ActionMenu,
  Button,
  ClickableRow,
  cn,
  type ActionMenuItem,
} from "@/src/core/ui";
import { eventSessionEditHref, type SessionStep } from "../routes";
import type { SessionDto } from "../schemas/sessions.schemas";
import {
  sessionDay,
  sessionPlace,
  sessionPrice,
  sessionTimes,
  SESSION_MODE_LABELS,
  SESSION_STATUS_META,
  SESSION_TYPE_LABELS,
  speakerNames,
} from "../utils/organizer-session-display";

const TH = "px-4 py-2.5 font-semibold";

/** The steps of the edit form, as the row menu offers them. */
const EDIT_STEPS: {
  step: SessionStep;
  label: string;
  icon: LucideIcon;
}[] = [
  { step: "details", label: "Edit details & speakers", icon: Pencil },
  { step: "content", label: "Edit content", icon: FileText },
  { step: "cover", label: "Cover image", icon: ImageIcon },
];

/**
 * The organizer's sessions of one event, one row each; a click on the row opens its edit page.
 * A cancelled session, or any session of an event that can no longer change, is read-only: no
 * link and no menu.
 */
export function EventSessionsTable({
  eventId,
  sessions,
  timezone,
  canEdit,
  onCancel,
}: {
  eventId: string;
  sessions: readonly SessionDto[];
  /** The event's own zone: times are shown in it, not in the viewer's. */
  timezone: string;
  /** The event is still a draft or published. */
  canEdit: boolean;
  onCancel: (session: SessionDto) => void;
}) {
  function rowActions(session: SessionDto): ActionMenuItem[] {
    const items: ActionMenuItem[] = EDIT_STEPS.map(({ step, label, icon }) => ({
      label,
      icon,
      href: eventSessionEditHref(eventId, session.id, step),
    }));
    items.push({
      label: "Cancel session",
      icon: X,
      tone: "danger",
      separatorBefore: true,
      onSelect: () => onCancel(session),
    });
    return items;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">Sessions of this event</caption>
        <thead className="bg-surface-subtle text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th scope="col" className={TH}>
              Session
            </th>
            <th scope="col" className={cn(TH, "whitespace-nowrap")}>
              When
            </th>
            <th scope="col" className={TH}>
              Where
            </th>
            <th scope="col" className={TH}>
              Speakers
            </th>
            <th scope="col" className={TH}>
              Price
            </th>
            <th scope="col" className={TH}>
              Status
            </th>
            <th scope="col" className={TH}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => {
            const status = SESSION_STATUS_META[session.status];
            const editable = canEdit && session.status !== "cancelled";
            const day = sessionDay(session, timezone);
            const times = sessionTimes(session, timezone);
            return (
              <ClickableRow
                key={session.id}
                className={cn(
                  "border-t border-line align-middle",
                  session.status === "cancelled" && "text-muted",
                )}
              >
                <td className="min-w-56 px-4 py-3">
                  {editable ? (
                    <Link
                      href={eventSessionEditHref(eventId, session.id)}
                      data-row-link
                      className="font-semibold hover:underline"
                    >
                      {session.title}
                    </Link>
                  ) : (
                    <span className="font-semibold">{session.title}</span>
                  )}
                  <p className="text-muted">
                    {SESSION_TYPE_LABELS[session.type]} ·{" "}
                    {SESSION_MODE_LABELS[session.mode]}
                  </p>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {day && times ? (
                    <>
                      {day}
                      <p className="text-muted">{times}</p>
                    </>
                  ) : (
                    <span className="text-muted">Not scheduled yet</span>
                  )}
                </td>
                <td className="px-4 py-3">{sessionPlace(session)}</td>
                <td className="min-w-40 px-4 py-3">{speakerNames(session)}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  {sessionPrice(session)}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={status.tone}>
                    <span
                      aria-hidden="true"
                      className="size-1.5 rounded-full bg-current"
                    />
                    {status.label}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  {editable && (
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="secondary"
                        className="text-danger"
                        aria-label={`Cancel ${session.title}`}
                        onClick={() => onCancel(session)}
                      >
                        <X aria-hidden="true" className="size-4" />
                        Cancel
                      </Button>
                      <ActionMenu
                        label={`Actions for ${session.title}`}
                        items={rowActions(session)}
                      />
                    </div>
                  )}
                </td>
              </ClickableRow>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
