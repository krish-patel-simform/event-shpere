"use client";

import { Alert, Button, Dialog, DialogBody, DialogFooter } from "@/src/core/ui";
import { useDeactivateVenue } from "../hooks/useDeactivateVenue";
import { pluralHalls, type VenueRef } from "../utils/venue-display";

/** Asks before deactivating a venue: guests stop seeing it and all its halls become inactive. */
export function DeactivateVenueDialog({
  venue,
  onClose,
}: {
  /** The venue to deactivate; null = closed. */
  venue: VenueRef | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={venue !== null}
      onClose={onClose}
      title={venue ? `Deactivate ${venue.name}?` : "Deactivate venue"}
    >
      {/* Mounted only while open: the request state starts fresh every time. */}
      {venue && <DeactivateVenueBody venue={venue} onClose={onClose} />}
    </Dialog>
  );
}

function DeactivateVenueBody({
  venue,
  onClose,
}: {
  venue: VenueRef;
  onClose: () => void;
}) {
  const deactivate = useDeactivateVenue(venue.id);

  return (
    <>
      <DialogBody>
        {deactivate.isError && (
          <Alert tone="error" title="We couldn't deactivate this venue">
            {deactivate.error.message}
          </Alert>
        )}
        <p>
          Guests and attendees will no longer see this venue or its halls, and
          organizers cannot pick it for new events.
        </p>
        <p>
          A venue cannot be deactivated while one of its halls has a session
          that is not over yet. Move or cancel those sessions first.
        </p>
        <Alert tone="warning">
          All {pluralHalls(venue.hallCount)} become inactive too. You can
          activate the venue again later; you then choose whether its halls
          become active as well.
        </Alert>
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="danger"
          isPending={deactivate.isPending}
          onClick={() => deactivate.mutate(undefined, { onSuccess: onClose })}
        >
          {deactivate.isPending ? "Deactivating…" : "Deactivate venue"}
        </Button>
      </DialogFooter>
    </>
  );
}
