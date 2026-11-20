import { PERMISSION } from "@/src/core/auth/permission-catalog";
import {
  paginated,
  parseQuery,
  PER_USER_HEADERS,
  route,
} from "@/src/core/http";
import {
  myRegistrationListQuerySchema,
  myTicketListResponseSchema,
} from "@/src/features/registrations";
import { registrationService } from "@/src/features/registrations/server";

// "My tickets": every event the signed-in user registered for, one page, cancelled ones included
// unless `status` filters them out. `when` picks upcoming or past events (default upcoming).
// There is no user id anywhere in the URL or the query: whose tickets these are comes from the
// login, so nobody can list someone else's. It carries ticket codes, so no cache may keep it.
export const GET = route(
  { permission: [PERMISSION.REGISTRATION_VIEW_OWN], rateLimit: "user-read" },
  async ({ req, currentUser }) => {
    const query = parseQuery(req, myRegistrationListQuerySchema);
    const { items, meta } = await registrationService.listMyRegistrations(
      query,
      currentUser,
    );
    return paginated(myTicketListResponseSchema.parse(items), meta, {
      headers: PER_USER_HEADERS,
    });
  },
);
