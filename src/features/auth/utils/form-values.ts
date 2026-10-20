/**
 * For optional text inputs: an empty box means "not provided" (undefined), not "".
 * Use as register("phone", { setValueAs: emptyToUndefined }). The shared Zod schemas treat
 * these fields as .optional(), so "" would fail their format rules.
 */
export function emptyToUndefined(value: string): string | undefined {
  return value === "" ? undefined : value;
}
