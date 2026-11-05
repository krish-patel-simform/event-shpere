"use client";

import { Alert, Button, Dialog, DialogBody, DialogFooter } from "@/src/core/ui";
import type { SessionDto } from "../schemas/sessions.schemas";

/**
 * Cancelling a session is final and affects other people, so it asks first and says what will
 * happen: its hall is free again and the seats booked for it are cancelled. The session stays in
 * the list, marked cancelled. The dialog stays open while the request runs and shows its error,
 * so a failure is never lost.
 */
export function CancelSessionDialog({
  session,
  isPending,
  error,
  onClose,
  onConfirm,
}: {
  /** The session the dialog is about; nothing is shown while it is null. */
  session: SessionDto | null;
  isPending: boolean;
  /** Why the last attempt failed, if it did. */
  error: string | null;
  onClose: () => void;
  onConfirm: (session: SessionDto) => void;
}) {
  return (
    <Dialog
      open={session !== null}
      onClose={onClose}
      title="Cancel this session?"
    >
      {session && (
        <>
          <DialogBody>
            <p>
              <strong>{session.title}</strong> stays in the list, marked
              cancelled.
            </p>
            <p>
              {session.hallName
                ? `${session.hallName} is free for another session, and any`
                : "Any"}{" "}
              seats booked for it are cancelled.
            </p>
            <p className="text-muted">This can&apos;t be undone.</p>
            {error && (
              <Alert tone="error" title="We couldn't cancel the session">
                {error}
              </Alert>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={onClose} disabled={isPending}>
              Keep session
            </Button>
            <Button
              variant="danger"
              isPending={isPending}
              onClick={() => onConfirm(session)}
            >
              {isPending ? "Cancelling…" : "Cancel session"}
            </Button>
          </DialogFooter>
        </>
      )}
    </Dialog>
  );
}
