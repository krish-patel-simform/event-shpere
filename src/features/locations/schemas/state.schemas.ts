import { z } from "zod";

//* GET /api/states: every state a venue can be in. Reference data, so no paging and no filters.
export const stateSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  // ISO 3166-2, e.g. IN-GJ.
  code: z.string(),
});

export const stateListResponseSchema = z.array(stateSchema);

export type StateDto = z.infer<typeof stateSchema>;
