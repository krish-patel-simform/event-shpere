import { ok, route } from "@/src/core/http";
import { stateListResponseSchema } from "@/src/features/locations";
import { stateService } from "@/src/features/locations/server";

// Public reference data (the states a venue or an event can be in). It only changes when the
// seed does, so browsers and the CDN may keep it for an hour.
export const GET = route({ auth: "public" }, async () => {
  const states = await stateService.listStates();
  return ok(stateListResponseSchema.parse(states), {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
});
