import "server-only";
import type { State } from "../../../db/schemas";
import type { StateDto } from "../schemas/state.schemas";

/** Picks fields one by one: countryCode and the timestamps are not part of the response. */
export function toStateDto(state: State): StateDto {
  return { id: state.id, name: state.name, code: state.code };
}
