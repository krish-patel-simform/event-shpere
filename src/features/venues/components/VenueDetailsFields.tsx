"use client";

import { useFormContext } from "react-hook-form";
import { Card, TextField } from "@/src/core/ui";
import type { VenueDetailsFormValues } from "../schemas/venue-form.schemas";
import { StateField } from "./StateField";

/**
 * The venue's own fields (address, state, map pin), shared by the add-venue form and the
 * edit-venue form. It reads the form from the surrounding <FormProvider>, so each form keeps
 * its own values type (the add form also has halls). `readOnly` is true while saving.
 */
export function VenueDetailsFields({ readOnly }: { readOnly: boolean }) {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<VenueDetailsFormValues>();

  return (
    <>
      <Card title="Venue details">
        <div className="space-y-4">
          <TextField
            label="Venue name"
            autoComplete="off"
            error={errors.name?.message}
            readOnly={readOnly}
            {...register("name")}
          />
          <TextField
            label="Address"
            autoComplete="off"
            error={errors.addressLine?.message}
            readOnly={readOnly}
            {...register("addressLine")}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField
              label="City"
              autoComplete="off"
              error={errors.city?.message}
              readOnly={readOnly}
              {...register("city")}
            />
            <StateField
              control={control}
              error={errors.state?.message}
              readOnly={readOnly}
            />
            <TextField
              label="Postal code"
              optional
              autoComplete="off"
              error={errors.postalCode?.message}
              readOnly={readOnly}
              {...register("postalCode")}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Fixed while the app is India-only. Not registered on purpose: a disabled input is
                not read by the form, so IN and Asia/Kolkata come from the form's values. */}
            <TextField
              label="Country"
              value="IN"
              readOnly
              disabled
              hint="Venues can only be added in India for now."
            />
            <TextField
              label="Time zone"
              value="Asia/Kolkata"
              readOnly
              disabled
              hint="Events held here use it for their start and end times."
            />
          </div>
        </div>
      </Card>

      <Card
        title="Map pin"
        description="Optional. Fill in both or leave both empty."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Latitude"
            inputMode="decimal"
            autoComplete="off"
            error={errors.latitude?.message}
            readOnly={readOnly}
            {...register("latitude")}
          />
          <TextField
            label="Longitude"
            inputMode="decimal"
            autoComplete="off"
            error={errors.longitude?.message}
            readOnly={readOnly}
            {...register("longitude")}
          />
        </div>
      </Card>
    </>
  );
}
