"use client";

import { Controller, type Control } from "react-hook-form";
import { StateSelect, useGetStateList } from "@/src/features/locations";
import type { CreateVenueFormValues } from "../schemas/venue-form.schemas";

/**
 * The state field of the venue form: a searchable list of state names, loaded once from
 * GET /api/states. The form keeps the chosen name (the API turns it into the state's id).
 */
export function StateField({
  control,
  error,
  readOnly,
}: {
  control: Control<CreateVenueFormValues>;
  error?: string;
  /** While the form is saving: the field cannot change. */
  readOnly?: boolean;
}) {
  const states = useGetStateList();

  return (
    <Controller
      control={control}
      name="state"
      render={({ field }) => (
        <StateSelect
          states={states.data}
          isLoading={states.isPending}
          loadFailed={states.isError}
          onRetry={() => void states.refetch()}
          value={field.value}
          onChange={field.onChange}
          onBlur={field.onBlur}
          error={error}
          disabled={readOnly}
        />
      )}
    />
  );
}
