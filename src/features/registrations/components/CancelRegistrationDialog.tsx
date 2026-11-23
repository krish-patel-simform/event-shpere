"use client";

import { Alert, Button, Dialog, DialogBody, DialogFooter } from "@/src/core/ui";

function seatsLine(bookedCount: number): string {
  if (bookedCount === 0)
    return "Any session seats you booked are cancelled too.";
  return bookedCount === 1
    ? "Your 1 session seat is cancelled too."
    : `Your ${bookedCount} session seats are cancelled too.`;
}

/** "Cancel your registration?": says what is lost before the user confirms (route 3). */
export function CancelRegistrationDialog({
  open,
  onClose,
  onConfirm,
  isPending,
  error,
  final = false,
  eventTitle,
  ticketCode,
  bookedCount,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
  /** A failure that keeps the dialog open (busy, network). */
  error: string | null;
  /** The failure cannot be fixed by trying again (closed, checked in): only "Close" is offered. */
  final?: boolean;
  eventTitle: string;
  ticketCode: string;
  bookedCount: number;
}) {
  return (
    <Dialog
      open={open}
      // Closing while the request runs would hide its answer: wait for it.
      onClose={() => !isPending && onClose()}
      title="Cancel your registration?"
    >
      <DialogBody>
        <p>
          You are registered for{" "}
          <strong className="text-foreground">{eventTitle}</strong>.
        </p>
        <ul className="list-disc space-y-1.5 pl-5 text-sm">
          <li>{seatsLine(bookedCount)}</li>
          <li>
            Ticket <span className="font-mono font-semibold">{ticketCode}</span>{" "}
            stops working.
          </li>
          <li>
            You can register again while registration is open and seats are
            left. You will get a new ticket code.
          </li>
        </ul>
        {error && (
          <Alert tone="error" title="We couldn't cancel that">
            {error}
          </Alert>
        )}
      </DialogBody>
      <DialogFooter>
        {final ? (
          <Button onClick={onClose}>Close</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={isPending}>
              Keep registration
            </Button>
            <Button variant="danger" onClick={onConfirm} isPending={isPending}>
              {isPending ? "Cancelling…" : "Cancel registration"}
            </Button>
          </>
        )}
      </DialogFooter>
    </Dialog>
  );
}
