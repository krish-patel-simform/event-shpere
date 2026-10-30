import type { UseFormRegisterReturn } from "react-hook-form";

/**
 * Wraps a react-hook-form register() result for a whole-number box (seats): anything that is
 * not a digit is dropped as it is typed or pasted, so letters never appear in the field.
 * Spread it like register(): `{...digitsOnly(register("capacity"))}`.
 */
export function digitsOnly<Name extends string>(
  registration: UseFormRegisterReturn<Name>,
): UseFormRegisterReturn<Name> {
  return {
    ...registration,
    onChange: (event) => {
      const input = event.target as HTMLInputElement;
      input.value = input.value.replace(/\D/g, "");
      return registration.onChange(event);
    },
  };
}
