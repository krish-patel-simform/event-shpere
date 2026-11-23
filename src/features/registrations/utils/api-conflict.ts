import type { ApiError } from "../../../core/api-client/base-api.service";

/**
 * The 409 code of `error` when it is one of `codes`, else null. A conflict code only counts on a
 * 409: the same code on another status is not the server's verdict on the current state.
 */
export function conflictOf<C extends string>(
  error: ApiError | null,
  codes: readonly C[],
): C | null {
  if (!error || error.status !== 409) return null;
  return codes.find((code) => code === error.code) ?? null;
}

/** True from the moment `iso` is reached (the server's rules use "at or after"). */
export function isPast(iso: string, now: Date): boolean {
  return new Date(iso).getTime() <= now.getTime();
}
