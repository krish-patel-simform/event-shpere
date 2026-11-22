"use client";

import { useGetEventAttendeeCounts } from "../hooks/useGetEventAttendeeCounts";
import { ListError } from "./attendee-list-parts";
import { EventCheckInDoor, type EventDoorEvent } from "./CheckInDoors";

/**
 * The event's Check-in tab: the door (route 6) with the counts of the day it checks in for. How
 * early each day's door opens is the server's setting, sent in route 5's meta, so it is read
 * first; until it arrives the door says it is loading, and if it fails the tab says so with a
 * retry (the door could otherwise never open).
 */
export function EventCheckInDesk({ event }: { event: EventDoorEvent }) {
  const summary = useGetEventAttendeeCounts(event.id, undefined);

  if (summary.isError) {
    return (
      <div className="rounded-lg border border-line bg-surface">
        <ListError
          title="We couldn't open the check-in door"
          error={summary.error}
          forbidden="This account cannot check people in at this event."
          onRetry={() => void summary.refetch()}
        />
      </div>
    );
  }

  return (
    <EventCheckInDoor
      event={event}
      opensHoursBefore={summary.data?.checkInOpensHoursBefore ?? null}
      showDayCounts
    />
  );
}
