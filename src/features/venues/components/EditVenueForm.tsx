"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { Alert, Button, buttonStyles } from "@/src/core/ui";
import { useUpdateVenue } from "../hooks/useUpdateVenue";
import { adminVenueHref } from "../routes";
import {
  editVenueFormSchema,
  toUpdateVenueBody,
  toVenueFormValues,
  type VenueDetailsFormValues,
} from "../schemas/venue-form.schemas";
import type { VenueDetailDto } from "../schemas/venue.schemas";
import { VenueDetailsFields } from "./VenueDetailsFields";

/**
 * Edits a venue's details. The form starts with the venue's current values and sends only the
 * fields that changed (nothing changed = no request). Halls are edited on the venue page.
 * After saving, the admin lands back on the venue's page, which already shows the new values.
 */
export function EditVenueForm({ venue }: { venue: VenueDetailDto }) {
  const router = useRouter();
  const update = useUpdateVenue(venue.id);
  const form = useForm<VenueDetailsFormValues>({
    resolver: zodResolver(editVenueFormSchema),
    defaultValues: toVenueFormValues(venue),
  });
  const { handleSubmit, reset } = form;
  const backHref = adminVenueHref(venue.id);

  // The cleanup below runs once, so it needs the venue as it is at that moment (after a save the
  // cache holds the new values), not the one from the first render.
  const latestVenue = useRef(venue);
  useEffect(() => {
    latestVenue.current = venue;
  }, [venue]);

  // Leaving the page hides it (React <Activity>) instead of unmounting it, so edits that were
  // not saved would still be in the form when the admin comes back. Start from the venue again.
  useLayoutEffect(
    () => () => {
      reset(toVenueFormValues(latestVenue.current));
      update.reset();
    },
    // `reset` and `update.reset` are stable; this must run only when the page is hidden.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // After a failed save, move keyboard focus to the message.
  const errorBox = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (update.isError) errorBox.current?.focus();
  }, [update.isError]);

  return (
    <FormProvider {...form}>
      <form
        noValidate
        className="max-w-3xl space-y-5"
        onSubmit={handleSubmit((values) => {
          const body = toUpdateVenueBody(values, venue);
          // Nothing changed: there is nothing to save.
          if (Object.keys(body).length === 0) {
            router.push(backHref);
            return;
          }
          update.mutate(body, { onSuccess: () => router.push(backHref) });
        })}
      >
        {update.isError && (
          <Alert
            ref={errorBox}
            tone="error"
            title="We couldn't save your changes"
          >
            {update.error.message}
          </Alert>
        )}

        <VenueDetailsFields readOnly={update.isPending} />

        <div className="flex flex-wrap justify-end gap-2.5">
          <Link
            href={backHref}
            className={buttonStyles({ variant: "secondary" })}
          >
            Cancel
          </Link>
          <Button type="submit" isPending={update.isPending}>
            {update.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
