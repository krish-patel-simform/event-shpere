import { paginated, parseQuery, route } from "@/src/core/http";
import {
  myEventListQuerySchema,
  myEventListResponseSchema,
} from "@/src/features/events";
import { eventService } from "@/src/features/events/server";

// The signed-in organizer's OWN events, one page: by status tab, searched by title, sorted by
// start date. There is no id in the URL: whose events they are comes from the login, so nobody
// can list another organizer's here. The service checks EVENT_MANAGE_OWN or EVENT_MANAGE_ALL
// and that an organizer is approved.
export const GET = route(
  { auth: "signed-in" },
  async ({ req, currentUser }) => {
    const query = parseQuery(req, myEventListQuerySchema);
    const { items, meta } = await eventService.listOwnEvents(
      query,
      currentUser,
    );
    return paginated(myEventListResponseSchema.parse(items), meta);
  },
);
