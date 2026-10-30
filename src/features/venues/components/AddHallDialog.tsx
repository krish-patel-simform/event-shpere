"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { ApiError } from "@/src/core/api-client/base-api.service";
import {
  Alert,
  Button,
  Dialog,
  DialogBody,
  DialogFooter,
  TextField,
} from "@/src/core/ui";
import { useAddHall } from "../hooks/useAddHall";
import {
  hallFormSchema,
  toCreateHallBody,
  type HallFormValues,
} from "../schemas/venue-form.schemas";
import { digitsOnly } from "../utils/digits-only";
import { pluralHalls, type VenueRef } from "../utils/venue-display";

/** Adds one hall to a venue. It is active straight away, placed last in the venue's list. */
export function AddHallDialog({
  venue,
  onClose,
}: {
  /** The venue to add the hall to; null = closed. */
  venue: VenueRef | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={venue !== null} onClose={onClose} title="Add a hall">
      {/* Mounted only while open: the fields and the request start fresh every time. */}
      {venue && <AddHallForm venue={venue} onClose={onClose} />}
    </Dialog>
  );
}

/** What the server said about one field, e.g. a taken name (409) or a bad value (400). */
function fieldError(error: ApiError | null, field: keyof HallFormValues) {
  if (!error) return undefined;
  if (field === "name" && error.code === "HALL_EXISTS") return error.message;
  return error.fieldErrors[field]?.[0];
}

function AddHallForm({
  venue,
  onClose,
}: {
  venue: VenueRef;
  onClose: () => void;
}) {
  const add = useAddHall(venue.id);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<HallFormValues>({
    resolver: zodResolver(hallFormSchema),
    defaultValues: { name: "", capacity: "" },
  });

  // Anything that is not about one field goes in the box on top.
  const error = add.error;
  const generalError =
    error &&
    error.code !== "HALL_EXISTS" &&
    Object.keys(error.fieldErrors).length === 0
      ? error.message
      : undefined;

  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) =>
        add.mutate(toCreateHallBody(values), { onSuccess: onClose }),
      )}
    >
      <DialogBody>
        {generalError && (
          <Alert tone="error" title="We couldn't add this hall">
            {generalError}
          </Alert>
        )}
        <p className="text-sm text-muted">
          Adding to{" "}
          <span className="font-semibold text-foreground">{venue.name}</span> (
          {pluralHalls(venue.hallCount)} now). The new hall is placed last and
          is active straight away.
        </p>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
          <TextField
            label="Hall name"
            placeholder="e.g. Conference Room A"
            autoComplete="off"
            autoFocus
            maxLength={100}
            error={errors.name?.message ?? fieldError(error, "name")}
            readOnly={add.isPending}
            {...register("name")}
          />
          <TextField
            label="Seats"
            placeholder="e.g. 120"
            inputMode="numeric"
            autoComplete="off"
            maxLength={5}
            hint="Numbers only"
            error={errors.capacity?.message ?? fieldError(error, "capacity")}
            readOnly={add.isPending}
            {...digitsOnly(register("capacity"))}
          />
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" isPending={add.isPending}>
          {add.isPending ? "Adding…" : "Add hall"}
        </Button>
      </DialogFooter>
    </form>
  );
}
