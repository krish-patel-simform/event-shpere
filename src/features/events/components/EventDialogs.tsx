"use client";

import { Button, Dialog, DialogBody, DialogFooter } from "@/src/core/ui";
import type { ManagedEvent } from "../types/event-manage.types";
import { plural } from "../utils/event-display";

type EventDialogProps = {
  /** The event the dialog is about; nothing is shown while it is null. */
  event: ManagedEvent | null;
  onClose: () => void;
  onConfirm: (event: ManagedEvent) => void;
  /** The request is running: the buttons show it, and the event cannot be kept meanwhile. */
  isPending?: boolean;
};

/** The sessions that are still on: they are the ones cancelling the event cancels. */
function liveSessions(event: ManagedEvent): number {
  return Math.max(event.sessions.total - event.sessions.cancelled, 0);
}

/** What happens to the sessions, in the singular or the plural. */
function sessionsLine(live: number): string {
  return live === 1
    ? "Its only session is cancelled too, and its hall is free again."
    : `All ${live} of its sessions are cancelled too, and their halls are free again.`;
}

/**
 * Cancelling is final and affects other people, so it asks first and says what will happen:
 * every session is cancelled with the event (their halls are free again), registration closes and
 * registered attendees are told. Only a published event can be cancelled.
 */
export function CancelEventDialog({
  event,
  onClose,
  onConfirm,
  isPending = false,
}: EventDialogProps) {
  return (
    <Dialog open={event !== null} onClose={onClose} title="Cancel this event?">
      {event && (
        <>
          <DialogBody>
            <p>
              <strong>{event.title}</strong> stays visible with a cancelled
              banner, and registration closes.
            </p>
            {liveSessions(event) > 0 && (
              <p>{sessionsLine(liveSessions(event))}</p>
            )}
            {event.registered > 0 && (
              <p>
                {plural(event.registered, "registered attendee")} will be
                notified, and their session bookings are cancelled too.
              </p>
            )}
            <p className="text-muted">This can&apos;t be undone.</p>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={onClose} disabled={isPending}>
              Keep event
            </Button>
            <Button
              variant="danger"
              isPending={isPending}
              onClick={() => onConfirm(event)}
            >
              {isPending ? "Cancelling…" : "Cancel event"}
            </Button>
          </DialogFooter>
        </>
      )}
    </Dialog>
  );
}

/** Deleting removes a draft for good, with its sessions. Only a draft can be deleted. */
export function DeleteDraftDialog({
  event,
  onClose,
  onConfirm,
}: EventDialogProps) {
  return (
    <Dialog open={event !== null} onClose={onClose} title="Delete this draft?">
      {event && (
        <>
          <DialogBody>
            <p>
              <strong>{event.title}</strong>
              {event.sessions.total > 0
                ? ` and its ${plural(event.sessions.total, "session")} are removed.`
                : " is removed."}
            </p>
            <p className="text-muted">This can&apos;t be undone.</p>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={onClose}>
              Keep draft
            </Button>
            <Button variant="danger" onClick={() => onConfirm(event)}>
              Delete draft
            </Button>
          </DialogFooter>
        </>
      )}
    </Dialog>
  );
}
