import { PERMISSION } from "@/src/core/auth/permission-catalog";
import { ok, parseInput, PER_USER_HEADERS, route } from "@/src/core/http";
import {
  myRegistrationResponseSchema,
  registrationEventParam,
} from "@/src/features/registrations";
import { registrationService } from "@/src/features/registrations/server";

// The signed-in user's OWN standing in this event: their registration (null if they never
// registered, which is a normal answer and not a 404; a cancelled one says "cancelled") and the
// sessions of the event they hold a seat in. "me" in the URL, and no user id anywhere: whose
// ticket it is comes from the login, so nobody can read someone else's. It carries a ticket code,
// so no cache may keep it.
export const GET = route<{ eventId: string }>(
  { permission: [PERMISSION.REGISTRATION_VIEW_OWN], rateLimit: "user-read" },
  async ({ params, currentUser }) => {
    const { eventId } = parseInput(registrationEventParam, await params);
    const mine = await registrationService.getMyRegistration(
      eventId,
      currentUser,
    );
    return ok(myRegistrationResponseSchema.parse(mine), {
      headers: PER_USER_HEADERS,
    });
  },
);

// Cancels the user's OWN registration, and their seats in this event's sessions, in one
// transaction. Allowed until registration closes (409 CANCELLATION_CLOSED after); a registration
// that was already used to check in is a 409 ALREADY_CHECKED_IN; no registration is a 404.
// Cancelling twice answers the cancelled registration again. It answers what the GET above would
// answer now, so the page can use it as it is. No refund: every ticket is free or complimentary.
export const DELETE = route<{ eventId: string }>(
  {
    permission: [PERMISSION.REGISTRATION_MANAGE_OWN],
    rateLimit: "user-write",
  },
  async ({ params, currentUser }) => {
    const { eventId } = parseInput(registrationEventParam, await params);
    const mine = await registrationService.cancelMyRegistration(
      eventId,
      currentUser,
    );
    return ok(myRegistrationResponseSchema.parse(mine));
  },
);
