"use client";

import { useRouter } from "next/navigation";
import { Alert, Button, Dialog, DialogBody, DialogFooter } from "@/src/core/ui";
import { useDeactivateVenue } from "../hooks/useDeactivateVenue";
import { useDeleteVenue } from "../hooks/useDeleteVenue";
import { VENUE_ROUTES } from "../routes";
import { pluralHalls, type VenueRef } from "../utils/venue-display";

/**
 * Asks before deleting a venue for good. The server only deletes a venue that was never used; if
 * an event or a session ever used it, the dialog says so and offers to deactivate it instead.
 * After a delete the venue no longer exists, so the admin goes back to the list.
 */
export function DeleteVenueDialog({
  venue,
  isActive,
  onClose,
}: {
  /** The venue to delete; null = closed. */
  venue: VenueRef | null;
  /** Whether the venue is active now: an inactive one has nothing to "deactivate instead". */
  isActive: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={venue !== null}
      onClose={onClose}
      title={venue ? `Delete ${venue.name}?` : "Delete venue"}
    >
      {/* Mounted only while open: the request state starts fresh every time. */}
      {venue && (
        <DeleteVenueBody venue={venue} isActive={isActive} onClose={onClose} />
      )}
    </Dialog>
  );
}

function DeleteVenueBody({
  venue,
  isActive,
  onClose,
}: {
  venue: VenueRef;
  isActive: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const remove = useDeleteVenue(venue.id);
  const deactivate = useDeactivateVenue(venue.id);

  const isInUse = remove.error?.code === "VENUE_IN_USE";
  // A refusal with its own explanation below; anything else is a general failure.
  const otherError = remove.isError && !isInUse;

  return (
    <>
      <DialogBody>
        {otherError && (
          <Alert tone="error" title="We couldn't delete this venue">
            {remove.error.message}
          </Alert>
        )}
        {isInUse && (
          <Alert tone="warning">
            This venue has events or sessions (even past or cancelled ones), so
            it cannot be deleted.{" "}
            {isActive
              ? "Deactivate it instead: it keeps its history and organizers can no longer pick it. That works once the sessions in its halls are over or cancelled."
              : "It is already inactive, which keeps its history and stops organizers from picking it."}
          </Alert>
        )}
        {deactivate.isError && (
          <Alert tone="error" title="We couldn't deactivate this venue">
            {deactivate.error.message}
          </Alert>
        )}
        {!isInUse && (
          <p>
            This removes the venue and its {pluralHalls(venue.hallCount)} for
            good. It only works for a venue that was never used by an event or a
            session. To keep the history, deactivate it instead.
          </p>
        )}
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={onClose}>
          {isInUse ? "Close" : "Cancel"}
        </Button>
        {isInUse ? (
          isActive && (
            <Button
              isPending={deactivate.isPending}
              onClick={() =>
                deactivate.mutate(undefined, { onSuccess: onClose })
              }
            >
              {deactivate.isPending ? "Deactivating…" : "Deactivate instead"}
            </Button>
          )
        ) : (
          <Button
            variant="danger"
            isPending={remove.isPending}
            onClick={() =>
              remove.mutate(undefined, {
                onSuccess: () => router.push(VENUE_ROUTES.list),
              })
            }
          >
            {remove.isPending ? "Deleting…" : "Delete venue"}
          </Button>
        )}
      </DialogFooter>
    </>
  );
}
