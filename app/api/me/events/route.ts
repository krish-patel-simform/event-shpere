import { paginated, parseQuery, route } from "@/src/core/http";
import {
  myEventListQuerySchema,
  myEventListResponseSchema,
} from "@/src/features/events";
import { eventService } from "@/src/features/events/server";

// The events the signed-in user manages, one page: by status tab, searched by title, sorted by
// start date. An organizer gets their OWN events; an admin gets EVERY event. Each row carries the
// registered count, the capacity and the venue. There is no id in the URL: whose events these are
// comes from the login, so an organizer can never list another organizer's here. The service
// checks EVENT_MANAGE_OWN or EVENT_MANAGE_ALL and that an organizer is approved.
export const GET = route(
  { auth: "signed-in", rateLimit: "user-read" },
  async ({ req, currentUser }) => {
    const query = parseQuery(req, myEventListQuerySchema);
    const { items, meta } = await eventService.listOwnEvents(
      query,
      currentUser,
    );
    return paginated(myEventListResponseSchema.parse(items), meta);
  },
);
