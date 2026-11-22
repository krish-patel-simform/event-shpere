"use client";

import { useId, useState } from "react";
import { formatZonedDateTime } from "@/src/core/format/format-zoned";
import { useNow } from "@/src/core/hooks/use-now";
import { cn, Kpi } from "@/src/core/ui";
import { useCheckInAtEvent } from "../hooks/useCheckInAtEvent";
import { useCheckInAtSession } from "../hooks/useCheckInAtSession";
import { useGetEventAttendeeCounts } from "../hooks/useGetEventAttendeeCounts";
import { checkedInPercent } from "../utils/attendee-display";
import {
  doorDays,
  eventDoor,
  sessionDoor,
  type DoorDay,
  type DoorEventStatus,
} from "../utils/check-in-door";
import { CheckInPanel, type CheckInPanelProps } from "./CheckInPanel";
import { SELECT_CLASS } from "./attendee-list-parts";

/** How often the door re-reads the clock, to open or close a day while the screen is open. */
const CLOCK_TICK_MS = 30_000;

const plural = (hours: number) => (hours === 1 ? "hour" : "hours");

/** "opens Wed 3 Dec 2026, 03:00" / "closed" next to a day the door cannot check in for. */
function dayOptionLabel(day: DoorDay, timezone: string): string {
  if (day.state === "not-open") {
    return `${day.label} (opens ${formatZonedDateTime(day.opensAt.toISOString(), timezone)})`;
  }
  if (day.state === "closed") return `${day.label} (closed)`;
  return day.label;
}

/** What the event door needs to know about the event. */
export type EventDoorEvent = {
  id: string;
  startAt: string;
  endAt: string;
  timezone: string;
  status: DoorEventStatus;
};

/**
 * The event door (route 6). It checks people in for ONE event day:
 * the day that is running, picked for the staff. On a multi-day event the other days are listed
 * but switched off, each saying when it opens or that it closed, so a code is never sent for a day
 * the server would refuse. `opensHoursBefore` comes from route 5 (null while it loads).
 */
export function EventCheckInDoor({
  event,
  opensHoursBefore,
  showDayCounts = false,
}: {
  event: EventDoorEvent;
  opensHoursBefore: number | null;
  /** Show "checked in / not yet" for the day being checked in (the Check-in tab does). */
  showDayCounts?: boolean;
}) {
  const now = useNow(CLOCK_TICK_MS);
  const dayId = useId();
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const send = useCheckInAtEvent(event.id);

  const days =
    opensHoursBefore === null ? [] : doorDays(event, opensHoursBefore, now);
  const door = eventDoor(event.status, days, pickedDay);

  let panelDoor: CheckInPanelProps["door"];
  if (opensHoursBefore === null) {
    panelDoor = {
      open: false,
      title: "Loading the door's hours",
      detail: "Check-in starts as soon as the registration counts have loaded.",
    };
  } else if (door.kind === "open") {
    panelDoor = {
      open: true,
      context: {
        door: "event",
        date: door.day.key,
        dayLabel: door.day.label,
        dayOfLabel: door.day.dayOfLabel,
      },
    };
  } else {
    panelDoor = { open: false, ...EVENT_DOOR_SHUT[door.kind] };
    if (door.kind === "not-open") {
      panelDoor.detail = `It opens ${formatZonedDateTime(
        door.opensAt.toISOString(),
        event.timezone,
      )}, ${opensHoursBefore} ${plural(opensHoursBefore)} before the day starts.`;
    }
  }

  const showDayPicker = days.length > 1 && door.kind !== "draft";

  return (
    <CheckInPanel
      title="Check in at the door"
      description="Type or scan the code on the attendee's ticket and press Enter. A person is checked in once per event day."
      rules="Check-ins can't be undone. On a multi-day event each person checks in once per day."
      door={panelDoor}
      timezone={event.timezone}
      send={send}
      controls={
        (showDayPicker || (showDayCounts && door.kind === "open")) && (
          <div className="space-y-4">
            {showDayPicker && (
              <div className="flex flex-wrap items-center gap-3">
                <label htmlFor={dayId} className="text-sm font-semibold">
                  Checking in for
                </label>
                <select
                  id={dayId}
                  value={door.kind === "open" ? door.day.key : ""}
                  disabled={door.kind !== "open"}
                  onChange={(change) => setPickedDay(change.target.value)}
                  className={cn(SELECT_CLASS, "disabled:text-muted")}
                >
                  {door.kind !== "open" && (
                    <option value="">No day open</option>
                  )}
                  {days.map((day) => (
                    <option
                      key={day.key}
                      value={day.key}
                      disabled={day.state !== "open"}
                    >
                      {dayOptionLabel(day, event.timezone)}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {showDayCounts && door.kind === "open" && (
              <DayCounts
                eventId={event.id}
                dayKey={door.day.key}
                dayLabel={door.day.label}
              />
            )}
          </div>
        )
      }
    />
  );
}

/**
 * How the day being checked in is going: checked in and still to come, for THAT day (route 5's
 * counts with its `date`). A check-in refreshes them (the door refreshes every attendee query).
 */
function DayCounts({
  eventId,
  dayKey,
  dayLabel,
}: {
  eventId: string;
  dayKey: string;
  dayLabel: string;
}) {
  const counts = useGetEventAttendeeCounts(eventId, dayKey).data?.counts;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Kpi
        label={`Checked in on ${dayLabel}`}
        value={counts?.checkedIn}
        note={
          counts
            ? `${checkedInPercent(counts.checkedIn, counts.registered)} of registered`
            : "of registered"
        }
      />
      <Kpi
        label="Not checked in yet"
        value={counts?.pending}
        note={`registered, not in on ${dayLabel}`}
      />
      <Kpi
        label="Registered"
        value={counts?.registered}
        note="active tickets"
      />
    </div>
  );
}

const EVENT_DOOR_SHUT = {
  draft: {
    title: "This event is still a draft",
    detail: "Publish the event before checking people in.",
  },
  cancelled: {
    title: "This event was cancelled",
    detail: "Nobody can be checked in.",
  },
  closed: {
    title: "Check-in is closed",
    detail: "Every day of this event is over.",
  },
  "not-open": { title: "Check-in is not open yet", detail: "" },
} as const;

/** What the session door needs to know about the session. */
export type SessionDoorSession = {
  status: "draft" | "scheduled" | "cancelled";
  startAt: string | null;
  endAt: string | null;
  eventStatus: DoorEventStatus;
  /** "Hall B" / "Online": shown in a check-in's row. */
  place: string | null;
};

/**
 * The session door (route 11). Only the code is sent: the server works out the event day from
 * the session's start. Open from `opensHoursBefore` before the session starts until it ends
 * (null while route 10's meta loads).
 */
export function SessionCheckInDoor({
  eventId,
  sessionId,
  session,
  timezone,
  opensHoursBefore,
  eventDoorHref,
}: {
  eventId: string;
  sessionId: string;
  session: SessionDoorSession;
  timezone: string;
  opensHoursBefore: number | null;
  /** The event's Check-in tab, where the event door is. */
  eventDoorHref: string;
}) {
  const now = useNow(CLOCK_TICK_MS);
  const send = useCheckInAtSession(eventId, sessionId);

  let panelDoor: CheckInPanelProps["door"];
  if (opensHoursBefore === null) {
    panelDoor = {
      open: false,
      title: "Loading the door's hours",
      detail: "Check-in starts as soon as the seat counts have loaded.",
    };
  } else {
    const door = sessionDoor(session, opensHoursBefore, now);
    if (door.kind === "open") {
      panelDoor = {
        open: true,
        context: { door: "session", place: session.place },
      };
    } else {
      panelDoor = { open: false, ...SESSION_DOOR_SHUT[door.kind] };
      if (door.kind === "not-open") {
        panelDoor.detail = `It opens ${formatZonedDateTime(
          door.opensAt.toISOString(),
          timezone,
        )}, ${opensHoursBefore} ${plural(opensHoursBefore)} before the session starts, and closes when it ends.`;
      }
    }
  }

  return (
    <CheckInPanel
      title="Check in at this session"
      description="Type the person's event ticket code and press Enter. They must already be checked in at the event door for this day."
      rules="A seat is checked in once. Check-ins can't be undone. Walk-ins without a seat are not recorded."
      door={panelDoor}
      timezone={timezone}
      send={send}
      eventDoorHref={eventDoorHref}
    />
  );
}

const SESSION_DOOR_SHUT = {
  "event-draft": {
    title: "This event is still a draft",
    detail: "Publish the event before checking people in.",
  },
  "event-cancelled": {
    title: "This event was cancelled",
    detail: "Nobody can be checked in.",
  },
  cancelled: {
    title: "This session was cancelled",
    detail: "Its seats were released, so nobody can be checked in.",
  },
  unscheduled: {
    title: "This session is not scheduled",
    detail: "Give it a time and a hall before checking people in.",
  },
  closed: {
    title: "Session check-in is closed",
    detail: "The session has ended.",
  },
  "not-open": { title: "Session check-in is not open yet", detail: "" },
} as const;
