"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import {
  Alert,
  Button,
  buttonStyles,
  Card,
  SearchableSelect,
  TextField,
  type SelectOption,
} from "@/src/core/ui";
import { StateSelect, useGetStateList } from "@/src/features/locations";
import { HallAvailability } from "@/src/features/venues";
import { useGetVenueOptions } from "../hooks/useGetVenueOptions";
import { eventHref, EVENT_ROUTES, publicEventHref } from "../routes";
import {
  createEventFormSchema,
  emptyEventForm,
  eventToFormValues,
  type EventFormValues,
} from "../schemas/event-form.schemas";
import type { ManagedEvent } from "../types/event-manage.types";
import { plural, zoneLabel } from "../utils/event-display";
import { toHallAvailabilityRange } from "../utils/hall-range";
import { EventStatusBadge } from "./EventStatusBadge";

type EventFormProps = {
  /** The event being edited; without it the form creates a new one. */
  event?: ManagedEvent;
  /** Called with the validated values. The parent saves them. */
  onSubmit: (values: EventFormValues) => void;
  /** The save is running: the form cannot change and the button waits. */
  isPending?: boolean;
  /** Why the last save failed, shown above the form. */
  error?: string;
};

/**
 * Step 1 of the event form (details): creates an event, or edits a draft or published one. The
 * page content and the images are the next two steps (EventContentStep, EventMediaStep). Every input is text; the
 * schema checks it with messages for the person filling the form. The public link is not an
 * input: the server makes it from the title. Times are India Standard Time.
 *
 * The venue is chosen in two steps: a state first (the list is short, so it is searched here in
 * the browser), then one of that state's venues (asked of the server by state). The state is only
 * a filter and is not part of the form's values: the event keeps just `venueId`, and its state
 * follows from the venue.
 */
export function EventForm({
  event,
  onSubmit,
  isPending = false,
  error,
}: EventFormProps) {
  const defaults = useMemo(
    () => (event ? eventToFormValues(event) : emptyEventForm),
    [event],
  );
  // An event that is already running keeps its (past) start while other fields change.
  const schema = useMemo(
    () =>
      createEventFormSchema(
        event
          ? { startDate: defaults.startDate, startTime: defaults.startTime }
          : undefined,
      ),
    [event, defaults],
  );
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<EventFormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  // After a failed save, move keyboard focus to the message.
  const errorBox = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) errorBox.current?.focus();
  }, [error]);

  // Editing an event starts on the state of its venue.
  const [stateName, setStateName] = useState(event?.venue?.state ?? "");
  const states = useGetStateList();
  const venues = useGetVenueOptions(stateName);

  // The hook runs once, here; the venue is looked up from its value.
  const chosenVenueId = useWatch({ control, name: "venueId" });
  // The event's dates as typed so far: once they make a valid range, the halls of the chosen
  // venue are checked against it. null until then, so nothing is requested.
  const [startDate, startTime, endDate, endTime] = useWatch({
    control,
    name: ["startDate", "startTime", "endDate", "endTime"],
  });
  const hallRange = useMemo(
    () => toHallAvailabilityRange({ startDate, startTime, endDate, endTime }),
    [startDate, startTime, endDate, endTime],
  );
  const chosenVenue = venues.options.find(
    (venue) => venue.id === chosenVenueId,
  );
  const isEdit = event !== undefined;

  const venueOptions = useMemo<SelectOption[]>(() => {
    const options = venues.options.map((venue) => ({
      value: venue.id,
      label: venue.name,
      hint: venue.city,
    }));
    // The event's own venue stays choosable even when it is no longer in the active list (an
    // administrator deactivated it): the select must not show an empty box for a venue it has.
    const own = event?.venue;
    if (
      own &&
      own.state === stateName &&
      !options.some((option) => option.value === own.id)
    ) {
      options.unshift({ value: own.id, label: own.name, hint: own.city });
    }
    return options;
  }, [venues.options, event, stateName]);

  /** Another state means another list of venues, so the venue chosen before no longer fits. */
  function changeState(next: string) {
    if (next === stateName) return;
    setStateName(next);
    setValue("venueId", "", { shouldDirty: true });
  }

  return (
    <form
      noValidate
      className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]"
      onSubmit={handleSubmit(onSubmit)}
    >
      <div className="min-w-0 space-y-5">
        {error && (
          <Alert
            ref={errorBox}
            tone="error"
            title={
              isEdit
                ? "We couldn't save your changes"
                : "We couldn't create this event"
            }
          >
            {error}
          </Alert>
        )}

        <Card title="Basics">
          <TextField
            label="Event title"
            autoComplete="off"
            readOnly={isPending}
            error={errors.title?.message}
            hint={
              event
                ? `Public link: ${publicEventHref(event.slug)}. It was made from the title when the event was created.`
                : "The public link is made from the title."
            }
            {...register("title")}
          />
        </Card>

        <Card
          title="Date and time"
          description="All times are in India Standard Time (IST). Session times must fall inside these dates."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Start date"
              type="date"
              readOnly={isPending}
              error={errors.startDate?.message}
              {...register("startDate")}
            />
            <TextField
              label="Start time"
              type="time"
              readOnly={isPending}
              error={errors.startTime?.message}
              {...register("startTime")}
            />
            <TextField
              label="End date"
              type="date"
              readOnly={isPending}
              error={errors.endDate?.message}
              {...register("endDate")}
            />
            <TextField
              label="End time"
              type="time"
              readOnly={isPending}
              error={errors.endTime?.message}
              {...register("endTime")}
            />
          </div>
        </Card>

        <Card
          title="Venue"
          description="Choose the state first, then one of its venues. Venues and their halls are managed by administrators."
        >
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <StateSelect
                states={states.data}
                isLoading={states.isPending}
                loadFailed={states.isError}
                onRetry={() => void states.refetch()}
                value={stateName}
                onChange={changeState}
                disabled={isPending}
              />
              <Controller
                control={control}
                name="venueId"
                render={({ field }) => (
                  <SearchableSelect
                    label="Venue"
                    options={venueOptions}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    emptyOption="Choose a venue later"
                    disabled={stateName === "" || venues.isLoading || isPending}
                    placeholder={
                      stateName === ""
                        ? "Choose a state first"
                        : venues.isLoading
                          ? "Loading venues…"
                          : "Choose a venue"
                    }
                    emptyMessage={`No active venues in ${stateName} yet.`}
                    noMatchMessage="No venue matches your search"
                    hint="The halls of the venue you pick become the columns of your schedule board."
                    error={
                      venues.isError ? (
                        <>
                          Could not load the venues.{" "}
                          <button
                            type="button"
                            className="underline"
                            onClick={venues.refetch}
                          >
                            Try again
                          </button>
                        </>
                      ) : undefined
                    }
                  />
                )}
              />
            </div>
            {chosenVenue && (
              <Alert tone="info">
                <strong>{chosenVenue.name}</strong> · {chosenVenue.addressLine}{" "}
                · {plural(chosenVenue.hallCount, "active hall")} ·{" "}
                {zoneLabel(chosenVenue.timezone)}
              </Alert>
            )}
            {/* Only when creating: an existing event's own sessions would show up as bookings. */}
            {chosenVenue && !isEdit && (
              <HallAvailability
                venueId={chosenVenue.id}
                range={hallRange}
                timezone={chosenVenue.timezone}
              />
            )}
          </div>
        </Card>

        <Card title="Tickets and capacity">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Event capacity"
              optional
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              // type="number" still lets "e", "+", "-" and "." through; a whole number has none.
              onKeyDown={(event) => {
                if (["e", "E", "+", "-", "."].includes(event.key)) {
                  event.preventDefault();
                }
              }}
              readOnly={isPending}
              error={errors.capacity?.message}
              hint="Maximum number of registrations. Leave empty for no limit."
              {...register("capacity")}
            />
            <TextField
              label="Ticket price (₹)"
              inputMode="decimal"
              placeholder="0"
              readOnly={isPending}
              error={errors.ticketPrice?.message}
              hint="Enter 0 for a free event. Shown as “Free” on the public page."
              {...register("ticketPrice")}
            />
          </div>
        </Card>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-4">
        <Card title="Status">
          <div className="space-y-3">
            <EventStatusBadge status={event?.status ?? "draft"} />
            <p className="text-muted">
              {event?.status === "published"
                ? "This event is public and open for registration."
                : "Only you can see this event. It becomes public and opens for registration when you publish it."}
            </p>
            {event && (
              <Link
                href={eventHref(event.id)}
                className="font-semibold text-link hover:underline"
              >
                Check publish requirements
              </Link>
            )}
          </div>
        </Card>
        <div className="space-y-2.5 rounded-lg border border-line bg-surface p-4">
          <Button type="submit" fullWidth isPending={isPending}>
            {isPending
              ? isEdit
                ? "Saving…"
                : "Creating event…"
              : isEdit
                ? "Save & continue"
                : "Create event"}
          </Button>
          <Link
            href={event ? eventHref(event.id) : EVENT_ROUTES.list}
            className={buttonStyles({ variant: "secondary", fullWidth: true })}
          >
            Cancel
          </Link>
        </div>
      </aside>
    </form>
  );
}
