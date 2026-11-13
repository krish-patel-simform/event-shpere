"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { Alert, Card, TextField } from "@/src/core/ui";
import { eventEditHref, toFormDateTime, zoneLabel } from "../../events";
import type { SessionFormValues } from "../schemas/session-form.schemas";
import {
  SESSION_MODE_LABELS,
  SESSION_TYPE_LABELS,
} from "../utils/organizer-session-display";
import { toSessionHallRange } from "../utils/session-hall-range";
import { HallPicker } from "./HallPicker";
import { SelectField } from "./SelectField";

/** The part of the event the fields need: its dates and zone (to limit the date) and its venue. */
export type SessionEventInfo = {
  id: string;
  startAt: string;
  endAt: string;
  timezone: string;
  venue: { id: string } | null;
};

/**
 * The details of a session as form fields: title and type, how it is attended (and the hall or
 * the join link that goes with it), the date and times, and registration and price. Used by the
 * add form and by the edit step, inside a react-hook-form `FormProvider` whose values include
 * `SessionFormValues`. Which of the hall and the link show follows the mode: an online session
 * has no hall, an in-person one has no link, a hybrid one has both. Times are in the event's own
 * zone, and the date can only be a day of the event.
 */
export function SessionDetailsFields({
  event,
  isPending,
  editing,
}: {
  event: SessionEventInfo;
  isPending: boolean;
  /**
   * Set when a saved session is edited: its own booking is left out of the halls' availability
   * (or its hall would look taken by itself), and its hall is marked "Booked by this session".
   */
  editing?: { sessionId: string; hallId: string | null };
}) {
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = useFormContext<SessionFormValues>();

  const [mode, date, startTime, endTime] = useWatch({
    control,
    name: ["mode", "date", "startTime", "endTime"],
  });
  const editingId = editing?.sessionId;
  const range = useMemo(() => {
    const slot = toSessionHallRange({ date, startTime, endTime });
    return slot && editingId ? { ...slot, exceptSessionId: editingId } : slot;
  }, [date, startTime, endTime, editingId]);
  const firstDay = toFormDateTime(event.startAt, event.timezone).date;
  const lastDay = toFormDateTime(event.endAt, event.timezone).date;
  const needsHall = mode !== "online";
  const needsLink = mode !== "in_person";

  return (
    <>
      <Card title="Basics">
        <div className="space-y-4">
          <TextField
            label="Session title"
            autoComplete="off"
            readOnly={isPending}
            error={errors.title?.message}
            {...register("title")}
          />
          <SelectField
            label="Type"
            disabled={isPending}
            error={errors.type?.message}
            {...register("type")}
          >
            <option value="">Choose a type</option>
            {Object.entries(SESSION_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>
        </div>
      </Card>

      <Card
        title="Date and time"
        description={`Times are in ${zoneLabel(event.timezone)}. A session must fall inside the event's dates.`}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField
            label="Date"
            type="date"
            min={firstDay}
            max={lastDay}
            readOnly={isPending}
            error={errors.date?.message}
            {...register("date")}
          />
          <TextField
            label="Start time"
            type="time"
            readOnly={isPending}
            error={errors.startTime?.message}
            {...register("startTime")}
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
        title="Where it takes place"
        description="An in-person session needs a hall, an online one a join link, a hybrid one both."
      >
        <div className="space-y-4">
          <SelectField
            label="How it is attended"
            disabled={isPending}
            error={errors.mode?.message}
            {...register("mode", {
              // Switching clears what no longer fits, so it is not sent with the new mode.
              onChange: (event) => {
                if (event.target.value === "online") setValue("hallId", "");
                if (event.target.value === "in_person") {
                  setValue("onlineUrl", "");
                }
              },
            })}
          >
            {Object.entries(SESSION_MODE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>

          {needsHall &&
            (event.venue ? (
              <Controller
                control={control}
                name="hallId"
                render={({ field }) => (
                  <HallPicker
                    venueId={event.venue?.id ?? ""}
                    range={range}
                    timezone={event.timezone}
                    ownHallId={editing?.hallId ?? null}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    disabled={isPending}
                    error={errors.hallId?.message}
                  />
                )}
              />
            ) : (
              <Alert tone="warning" title="This event has no venue yet">
                A hall belongs to the event&apos;s venue.{" "}
                <Link
                  href={eventEditHref(event.id)}
                  className="font-semibold underline"
                >
                  Choose a venue
                </Link>{" "}
                first, or make this an online session.
              </Alert>
            ))}

          {needsLink && (
            <TextField
              label="Join link"
              type="url"
              inputMode="url"
              autoComplete="off"
              placeholder="https://"
              readOnly={isPending}
              error={errors.onlineUrl?.message}
              {...register("onlineUrl")}
            />
          )}
        </div>
      </Card>

      <Card title="Booking and price">
        <div className="space-y-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              disabled={isPending}
              className="mt-1 size-4"
              {...register("requiresRegistration")}
            />
            <span>
              <span className="block text-sm font-semibold">
                Attendees must book a seat
              </span>
              <span className="block text-xs text-muted">
                The seats are the hall&apos;s capacity. Leave it off for a
                session anyone with a ticket can walk into.
              </span>
            </span>
          </label>
          <TextField
            label="Extra price (₹)"
            inputMode="decimal"
            placeholder="0"
            readOnly={isPending}
            error={errors.price?.message}
            hint="On top of the event ticket. Enter 0 when the session is included."
            {...register("price")}
          />
        </div>
      </Card>
    </>
  );
}
