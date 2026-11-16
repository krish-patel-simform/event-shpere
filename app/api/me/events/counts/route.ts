import { ok, route } from "@/src/core/http";
import { eventTabCountsSchema } from "@/src/features/events";
import { eventService } from "@/src/features/events/server";

// How many of the signed-in organizer's events each tab holds (all, draft, published, completed,
// cancelled). Separate from the list so the tab numbers do not change with the search.
export const GET = route({ auth: "signed-in" }, async ({ currentUser }) => {
  const counts = await eventService.countOwnEvents(currentUser);
  return ok(eventTabCountsSchema.parse(counts));
});
