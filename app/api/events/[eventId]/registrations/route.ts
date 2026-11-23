import { PERMISSION } from "@/src/core/auth/permission-catalog";
import { created, parseInput, route } from "@/src/core/http";
import {
  registrationEventParam,
  registrationResponseSchema,
} from "@/src/features/registrations";
import { registrationService } from "@/src/features/registrations/server";

// The signed-in user registers for the event. No body: the event is in the URL and the user is
// the session's, so nobody can register someone else. 201 with the new ticket. Registering twice
// is a 409 ALREADY_REGISTERED ("You are already registered for this event"); their ticket is
// `GET .../registrations/me`. A draft or unknown event is a 404; a cancelled, over, not-yet-open,
// closed, full or paid event is a 409 that names the rule. Only free tickets for now: a speaker
// of the event gets one complimentary.
export const POST = route<{ eventId: string }>(
  { permission: [PERMISSION.REGISTRATION_CREATE], rateLimit: "user-write" },
  async ({ params, currentUser }) => {
    const { eventId } = parseInput(registrationEventParam, await params);
    const registration = await registrationService.register(
      eventId,
      currentUser,
    );
    return created(registrationResponseSchema.parse(registration));
  },
);
