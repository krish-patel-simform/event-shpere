"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Minus, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";
import { FormProvider, useFieldArray, useForm } from "react-hook-form";
import { Alert, Button, buttonStyles, Card, TextField } from "@/src/core/ui";
import { useCreateVenue } from "../hooks/useCreateVenue";
import { adminVenueHref, VENUE_ROUTES } from "../routes";
import {
  createVenueFormSchema,
  emptyVenueForm,
  toCreateVenueBody,
  type CreateVenueFormValues,
} from "../schemas/venue-form.schemas";
import { digitsOnly } from "../utils/digits-only";
import { VenueDetailsFields } from "./VenueDetailsFields";

const MAX_HALLS = 50;

/**
 * The form that adds a venue together with its halls. Every input is text; the schema checks it
 * with messages for the person filling the form, and toCreateVenueBody turns it into the body
 * POST /api/venues takes. After saving, the admin lands on the new venue's page.
 */
export function CreateVenueForm() {
  const router = useRouter();
  const create = useCreateVenue();
  const form = useForm<CreateVenueFormValues>({
    resolver: zodResolver(createVenueFormSchema),
    defaultValues: emptyVenueForm,
  });
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "halls" });

  // Leaving the page hides it (React <Activity>) instead of unmounting it, so the form would
  // still be filled in when the admin comes back. Start it empty again.
  useLayoutEffect(
    () => () => {
      reset(emptyVenueForm);
      create.reset();
    },
    // `reset` and `create.reset` are stable; this must run only when the page is hidden.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // After a failed save, move keyboard focus to the message.
  const errorBox = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (create.isError) errorBox.current?.focus();
  }, [create.isError]);

  const hallsError = errors.halls?.message ?? errors.halls?.root?.message;

  return (
    <FormProvider {...form}>
      <form
        noValidate
        className="max-w-3xl space-y-5"
        onSubmit={handleSubmit((values) =>
          create.mutate(toCreateVenueBody(values), {
            onSuccess: (venue) => router.push(adminVenueHref(venue.id)),
          }),
        )}
      >
        {create.isError && (
          <Alert ref={errorBox} tone="error" title="We couldn't add this venue">
            {create.error.message}
          </Alert>
        )}

        <VenueDetailsFields readOnly={create.isPending} />

        <Card
          title="Halls"
          description={`At least one, up to ${MAX_HALLS}. They appear in this order on the schedule board.`}
        >
          <div className="space-y-4">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="grid grid-cols-[minmax(0,1fr)_7rem_2.5rem] items-start gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_2.5rem]"
              >
                <TextField
                  label="Hall name"
                  autoComplete="off"
                  error={errors.halls?.[index]?.name?.message}
                  readOnly={create.isPending}
                  {...register(`halls.${index}.name`)}
                />
                <TextField
                  label="Seats"
                  placeholder="e.g. 120"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={5}
                  error={errors.halls?.[index]?.capacity?.message}
                  readOnly={create.isPending}
                  {...digitsOnly(register(`halls.${index}.capacity`))}
                />
                {/* Aligned with the inputs, not the labels above them. */}
                <button
                  type="button"
                  aria-label={`Remove hall ${index + 1}`}
                  disabled={fields.length === 1 || create.isPending}
                  onClick={() => remove(index)}
                  className="mt-7 inline-flex size-10 items-center justify-center rounded-md border border-field text-danger hover:bg-danger-soft disabled:cursor-not-allowed disabled:text-muted disabled:hover:bg-transparent"
                >
                  <Minus aria-hidden="true" className="size-4" />
                </button>
              </div>
            ))}
            {hallsError && (
              <p role="alert" className="text-sm text-danger">
                {hallsError}
              </p>
            )}
            <Button
              variant="secondary"
              disabled={fields.length >= MAX_HALLS || create.isPending}
              onClick={() => append({ name: "", capacity: "" })}
            >
              <Plus aria-hidden="true" className="size-4" />
              Add another hall
            </Button>
          </div>
        </Card>

        <div className="flex flex-wrap justify-end gap-2.5">
          <Link
            href={VENUE_ROUTES.list}
            className={buttonStyles({ variant: "secondary" })}
          >
            Cancel
          </Link>
          <Button type="submit" isPending={create.isPending}>
            {create.isPending ? "Creating…" : "Create venue"}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
