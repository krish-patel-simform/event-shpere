// Calls to the states API, built on the shared axios instance. The hooks (../hooks) wrap these.
import { apiRequest } from "../../../core/api-client/base-api.service";
import {
  stateListResponseSchema,
  type StateDto,
} from "../schemas/state.schemas";

export const stateApiService = {
  /** Every state, A to Z. */
  list(): Promise<StateDto[]> {
    return apiRequest(
      { method: "GET", url: "/states" },
      stateListResponseSchema,
    );
  },
};
