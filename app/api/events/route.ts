import { PERMISSION } from "@/src/core/auth/permission-catalog";
import {
  created,
  paginated,
  parseBody,
  parseQuery,
  route,
} from "@/src/core/http";
import {
  createEventBodySchema,
  eventResponseSchema,
  publicEventListQuerySchema,
  publicEventListResponseSchema,
} from "@/src/features/events";
import { eventService } from "@/src/features/events/server";

// DISC-1 to DISC-4: the events anyone can browse, guests included. Published events only (never
// drafts, never cancelled ones), searched by title, filtered, sorted and paged by the server. It
// is NOT the organizer's list (that is /api/me/events) and shows none of an organizer's figures.
export const GET = route({ auth: "public" }, async ({ req }) => {
  const query = parseQuery(req, publicEventListQuerySchema);
  const { items, meta } = await eventService.listPublicEvents(query);
  return paginated(publicEventListResponseSchema.parse(items), meta);
});

// An approved organizer (or an admin) creates an event. It is always saved as a draft owned by
// the caller. Anyone else gets 401/403 from the wrapper or the service.
export const POST = route(
  { permission: [PERMISSION.EVENT_CREATE] },
  async ({ req, currentUser }) => {
    const body = await parseBody(req, createEventBodySchema);
    const event = await eventService.createEvent(body, currentUser);
    return created(eventResponseSchema.parse(event));
  },
);
