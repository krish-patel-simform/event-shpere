import "server-only";
import type { StateDto } from "../schemas/state.schemas";
import { toStateDto } from "./state.dto";
import { stateRepository, type StateRepository } from "./state.repository";

export type StateServiceDeps = {
  stateRepository: Pick<StateRepository, "listStates">;
};

export function createStateService({ stateRepository }: StateServiceDeps) {
  return {
    /** All states for a dropdown. Public reference data: no permission or ownership to check. */
    async listStates(): Promise<StateDto[]> {
      const states = await stateRepository.listStates();
      return states.map(toStateDto);
    },
  };
}

export type StateService = ReturnType<typeof createStateService>;

export const stateService = createStateService({ stateRepository });
