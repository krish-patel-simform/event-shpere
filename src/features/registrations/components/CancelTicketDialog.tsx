"use client";

import { useCancelRegistration } from "../hooks/useCancelRegistration";
import type { MyTicketDto } from "../schemas/registrations.schemas";
import { ticketCancelFailure } from "../utils/my-ticket-state";
import { CancelRegistrationDialog } from "./CancelRegistrationDialog";

/**
 * "Cancel your registration?" for one row of "My tickets" (route 3). Rendered only while a row
 * is being cancelled, so its mutation belongs to that row's event. Every failure stays in the
 * dialog: the list has no card to show it on.
 */
export function CancelTicketDialog({
  ticket,
  onClose,
  onCancelled,
}: {
  ticket: MyTicketDto;
  onClose: () => void;
  /** The cancel went through: the parent closes the dialog and says so. */
  onCancelled: (ticket: MyTicketDto) => void;
}) {
  const cancel = useCancelRegistration(ticket.event.id);
  const failure = ticketCancelFailure(cancel.error);

  return (
    <CancelRegistrationDialog
      open
      onClose={onClose}
      onConfirm={() =>
        cancel.mutate(undefined, { onSuccess: () => onCancelled(ticket) })
      }
      isPending={cancel.isPending}
      error={failure?.message ?? null}
      final={failure?.final ?? false}
      eventTitle={ticket.event.title}
      ticketCode={ticket.registration.ticketCode}
      bookedCount={ticket.bookedSessionCount}
    />
  );
}
