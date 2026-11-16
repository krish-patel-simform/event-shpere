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
import { useUpdateHall } from "../hooks/useUpdateHall";
import {
  hallFormSchema,
  toUpdateHallBody,
  type HallFormValues,
} from "../schemas/venue-form.schemas";
import { digitsOnly } from "../utils/digits-only";

export type EditableHall = { id: string; name: string; capacity: number };

/** Renames a hall and/or changes its seats. Only what changed is sent. */
export function EditHallDialog({
  venueId,
  hall,
  onClose,
}: {
  venueId: string;
  /** The hall to edit; null = closed. */
  hall: EditableHall | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={hall !== null}
      onClose={onClose}
      title={hall ? `Edit ${hall.name}` : "Edit hall"}
    >
      {/* Mounted only while open: the fields and the request start fresh every time. */}
      {hall && <EditHallForm venueId={venueId} hall={hall} onClose={onClose} />}
    </Dialog>
  );
}

/** What the server said about one field: a taken name, or a bad value (400). */
function fieldError(error: ApiError | null, field: keyof HallFormValues) {
  if (!error) return undefined;
  if (field === "name" && error.code === "HALL_EXISTS") return error.message;
  return error.fieldErrors[field]?.[0];
}

function EditHallForm({
  venueId,
  hall,
  onClose,
}: {
  venueId: string;
  hall: EditableHall;
  onClose: () => void;
}) {
  const update = useUpdateHall(venueId, hall.id);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<HallFormValues>({
    resolver: zodResolver(hallFormSchema),
    defaultValues: { name: hall.name, capacity: String(hall.capacity) },
  });

  // A session that is not over yet uses the hall: the whole form is refused, not one field.
  const error = update.error;
  const isInUse = error?.code === "HALL_HAS_SESSIONS";
  // Anything else that is not about one field goes in the box on top.
  const generalError =
    error &&
    !isInUse &&
    error.code !== "HALL_EXISTS" &&
    Object.keys(error.fieldErrors).length === 0
      ? error.message
      : undefined;

  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) => {
        const body = toUpdateHallBody(values, hall);
        // Nothing changed: there is nothing to save.
        if (Object.keys(body).length === 0) {
          onClose();
          return;
        }
        update.mutate(body, { onSuccess: onClose });
      })}
    >
      <DialogBody>
        {isInUse && (
          <Alert tone="warning" title="This hall is in use">
            {error.message}
          </Alert>
        )}
        {generalError && (
          <Alert tone="error" title="We couldn't save this hall">
            {generalError}
          </Alert>
        )}
        <p className="text-sm text-muted">
          A hall can only be edited when it has no sessions that are not over
          yet: its name and seats are in emails, tickets and the public pages.
        </p>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
          <TextField
            label="Hall name"
            autoComplete="off"
            autoFocus
            maxLength={100}
            error={errors.name?.message ?? fieldError(error, "name")}
            readOnly={update.isPending}
            {...register("name")}
          />
          <TextField
            label="Seats"
            inputMode="numeric"
            autoComplete="off"
            maxLength={5}
            hint="Numbers only"
            error={errors.capacity?.message ?? fieldError(error, "capacity")}
            readOnly={update.isPending}
            {...digitsOnly(register("capacity"))}
          />
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" isPending={update.isPending}>
          {update.isPending ? "Saving…" : "Save hall"}
        </Button>
      </DialogFooter>
    </form>
  );
}
