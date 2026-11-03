import "server-only";
import { PERMISSION } from "../../../core/auth/permission-catalog";
import type { CurrentUser } from "../../../core/auth/server/auth-session";
// Direct file import: the core/http barrel also pulls in the route wrapper and cookies.
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../../core/http/errors";
import type { OrganizerService } from "../../organizer/server";
import type { EventRef, EventRepository } from "./event.repository";

/** Who is asking: the signed-in user from the access token. */
export type EventActor = Pick<CurrentUser, "id" | "role" | "permissions">;

export type EventAccessDeps = {
  eventRepository: Pick<EventRepository, "findEventById">;
  /** An organizer may manage events only while an admin's approval stands. */
  organizerVerification: Pick<OrganizerService, "assertVerifiedOrganizer">;
};

/**
 * The rule every organizer action on events shares: who may touch which event. One place, so the
 * overview, the edit and the event page cannot disagree.
 */
export function createEventAccess(deps: EventAccessDeps) {
  const hasAll = (actor: EventActor) =>
    actor.permissions.has(PERMISSION.EVENT_MANAGE_ALL);
  const hasOwn = (actor: EventActor) =>
    actor.permissions.has(PERMISSION.EVENT_MANAGE_OWN);

  return {
    /**
     * May this user manage events at all? EVENT_MANAGE_OWN (organizer) or EVENT_MANAGE_ALL
     * (admin), and an organizer must be approved. For lists, where there is no one event yet.
     *
     * Returns the organizer's profile id (what events.organizer_id holds), or null for an admin:
     * an admin has no organizer profile, so no event is "theirs".
     */
    async requireManager(actor: EventActor): Promise<string | null> {
      if (!hasAll(actor) && !hasOwn(actor)) throw new ForbiddenError();
      return deps.organizerVerification.assertVerifiedOrganizer(actor);
    },

    /**
     * Who may touch this event: EVENT_MANAGE_ALL (admin) any event, EVENT_MANAGE_OWN (organizer)
     * only their own. Somebody else's event is a 404, never a 403, so its existence is not
     * revealed. A write also needs a not-cancelled event.
     */
    async requireEvent(
      eventId: string,
      actor: EventActor,
      { write }: { write: boolean },
    ): Promise<EventRef> {
      if (!hasAll(actor) && !hasOwn(actor)) throw new ForbiddenError();

      // The event's owner is an organizer PROFILE, so compare with the caller's profile id, not
      // their user id.
      const organizerId =
        await deps.organizerVerification.assertVerifiedOrganizer(actor);

      const event = await deps.eventRepository.findEventById(eventId);
      if (!event || (!hasAll(actor) && event.organizerId !== organizerId)) {
        throw new NotFoundError("Event not found");
      }
      if (write && event.status === "cancelled") {
        throw new ConflictError(
          "EVENT_CANCELLED",
          "A cancelled event can no longer be edited",
        );
      }
      return event;
    },
  };
}

export type EventAccess = ReturnType<typeof createEventAccess>;
