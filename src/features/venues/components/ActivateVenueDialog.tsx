"use client";

import { useState } from "react";
import {
  Alert,
  Button,
  cn,
  Dialog,
  DialogBody,
  DialogFooter,
} from "@/src/core/ui";
import { useActivateVenue } from "../hooks/useActivateVenue";
import { pluralHalls, type VenueRef } from "../utils/venue-display";

/** Asks before activating an inactive venue, and whether its halls (all inactive now) become active too. */
export function ActivateVenueDialog({
  venue,
  onClose,
}: {
  /** The venue to activate; null = closed. */
  venue: VenueRef | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={venue !== null}
      onClose={onClose}
      title={venue ? `Activate ${venue.name}?` : "Activate venue"}
    >
      {/* Mounted only while open: the choice and the request start fresh every time. */}
      {venue && <ActivateVenueBody venue={venue} onClose={onClose} />}
    </Dialog>
  );
}

function ActivateVenueBody({
  venue,
  onClose,
}: {
  venue: VenueRef;
  onClose: () => void;
}) {
  const activate = useActivateVenue(venue.id);
  // Halls stay inactive by default: the table cannot tell which were deactivated on purpose.
  const [activateHalls, setActivateHalls] = useState<"all" | "none">("none");

  const options = [
    {
      value: "none",
      title: "Venue only",
      help: "Halls stay inactive. Activate them one by one from the venue page; safest if a hall was closed on purpose.",
    },
    {
      value: "all",
      title: `Venue and all ${pluralHalls(venue.hallCount)}`,
      help: "Everything is available to organizers again straight away.",
    },
  ] as const;

  return (
    <>
      <DialogBody>
        {activate.isError && (
          <Alert tone="error" title="We couldn't activate this venue">
            {activate.error.message}
          </Alert>
        )}
        <p>
          The venue becomes visible again. Its {pluralHalls(venue.hallCount)}{" "}
          are inactive now: choose what to activate.
        </p>
        <fieldset className="space-y-2.5">
          <legend className="mb-1.5 text-sm font-semibold">Activate</legend>
          {options.map((option) => (
            <label
              key={option.value}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-md border p-3",
                activateHalls === option.value
                  ? "border-brand bg-brand-soft"
                  : "border-field",
              )}
            >
              <input
                type="radio"
                name="activate-halls"
                value={option.value}
                checked={activateHalls === option.value}
                onChange={() => setActivateHalls(option.value)}
                className="mt-1 size-4 shrink-0"
              />
              <span>
                <span className="block font-semibold">{option.title}</span>
                <span className="text-sm text-muted">{option.help}</span>
              </span>
            </label>
          ))}
        </fieldset>
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          isPending={activate.isPending}
          onClick={() => activate.mutate(activateHalls, { onSuccess: onClose })}
        >
          {activate.isPending ? "Activating…" : "Activate venue"}
        </Button>
      </DialogFooter>
    </>
  );
}
