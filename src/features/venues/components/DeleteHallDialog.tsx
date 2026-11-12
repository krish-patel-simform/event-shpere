"use client";

import { Alert, Button, Dialog, DialogBody, DialogFooter } from "@/src/core/ui";
import { useDeleteHall } from "../hooks/useDeleteHall";
import { useSetHallsStatus } from "../hooks/useSetHallsStatus";

export type HallRef = { id: string; name: string };

/**
 * Asks before deleting a hall for good. If the server refuses, the dialog says why: it is the
 * venue's last hall (add another first), or sessions use it (deactivate it instead, offered here).
 */
export function DeleteHallDialog({
  venueId,
  hall,
  onClose,
}: {
  venueId: string;
  /** The hall to delete; null = closed. */
  hall: HallRef | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={hall !== null}
      onClose={onClose}
      title={hall ? `Delete ${hall.name}?` : "Delete hall"}
    >
      {/* Mounted only while open: the request state starts fresh every time. */}
      {hall && (
        <DeleteHallBody venueId={venueId} hall={hall} onClose={onClose} />
      )}
    </Dialog>
  );
}

function DeleteHallBody({
  venueId,
  hall,
  onClose,
}: {
  venueId: string;
  hall: HallRef;
  onClose: () => void;
}) {
  const remove = useDeleteHall(venueId);
  const deactivate = useSetHallsStatus(venueId);

  const code = remove.error?.code;
  const isLastHall = code === "LAST_HALL";
  const isInUse = code === "HALL_IN_USE";
  // A refusal with its own explanation below; anything else is a general failure.
  const otherError = remove.isError && !isLastHall && !isInUse;

  return (
    <>
      <DialogBody>
        {otherError && (
          <Alert tone="error" title="We couldn't delete this hall">
            {remove.error.message}
          </Alert>
        )}
        {isLastHall && (
          <Alert tone="error">
            A venue must keep at least one hall. Add another hall first, then
            delete this one.
          </Alert>
        )}
        {isInUse && (
          <Alert tone="warning">
            Sessions are scheduled in this hall, so it cannot be deleted.
            Deactivate it instead: it keeps its history and takes no new
            sessions. That works once its sessions are over or cancelled.
          </Alert>
        )}
        {deactivate.isError && (
          <Alert tone="error" title="We couldn't deactivate this hall">
            {deactivate.error.message}
          </Alert>
        )}
        {!isLastHall && !isInUse && (
          <p>
            This removes the hall for good. To keep the hall but stop using it,
            deactivate it instead.
          </p>
        )}
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={onClose}>
          {isLastHall || isInUse ? "Close" : "Cancel"}
        </Button>
        {isInUse ? (
          <Button
            isPending={deactivate.isPending}
            onClick={() =>
              deactivate.mutate(
                { isActive: false, halls: [hall.id] },
                { onSuccess: onClose },
              )
            }
          >
            {deactivate.isPending ? "Deactivating…" : "Deactivate instead"}
          </Button>
        ) : (
          <Button
            variant="danger"
            disabled={isLastHall}
            isPending={remove.isPending}
            onClick={() => remove.mutate(hall.id, { onSuccess: onClose })}
          >
            {remove.isPending ? "Deleting…" : "Delete hall"}
          </Button>
        )}
      </DialogFooter>
    </>
  );
}
