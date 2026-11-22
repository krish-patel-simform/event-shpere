"use client";

import { Alert, Button, Dialog, DialogBody, DialogFooter } from "@/src/core/ui";

/** "Cancel your seat?": one session seat only, the event registration stays (route 9). */
export function CancelSeatDialog({
  open,
  onClose,
  onConfirm,
  isPending,
  error,
  sessionTitle,
  when,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
  /** A failure that keeps the dialog open (busy, network). */
  error: string | null;
  sessionTitle: string;
  /** "Fri 4 Dec 2026, 10:00 · Lab 3", or null when the session has no time yet. */
  when: string | null;
}) {
  return (
    <Dialog
      open={open}
      // Closing while the request runs would hide its answer: wait for it.
      onClose={() => !isPending && onClose()}
      title="Cancel your seat?"
    >
      <DialogBody>
        <p>
          <strong className="text-foreground">{sessionTitle}</strong>
          {when && (
            <>
              <br />
              <span className="text-sm text-muted">{when}</span>
            </>
          )}
        </p>
        <p className="text-sm">
          Your seat is released for someone else. You stay registered for the
          event.
        </p>
        {error && (
          <Alert tone="error" title="We couldn't cancel that">
            {error}
          </Alert>
        )}
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={onClose} disabled={isPending}>
          Keep seat
        </Button>
        <Button variant="danger" onClick={onConfirm} isPending={isPending}>
          {isPending ? "Cancelling…" : "Cancel seat"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
