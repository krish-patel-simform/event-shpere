"use client";

import { Check } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";
import { PasswordField } from "@/src/core/ui";
import { PasswordRequirements } from "./PasswordRequirements";

type PasswordPair = { password: string; confirmPassword: string };

type PasswordWithConfirmProps = {
  passwordLabel?: string;
  confirmLabel?: string;
  /** True while the form is submitting: the fields stay visible but cannot be changed. */
  readOnly?: boolean;
  /** Show the live rule checklist under the password field. */
  showRequirements?: boolean;
  /**
   * `stacked`: password, checklist, confirm, one under the other (narrow forms).
   * `split`: password and confirm side by side, checklist below both (wide forms).
   */
  layout?: "stacked" | "split";
};

/**
 * The "new password + confirm" pair used by every form that sets a password. It must be
 * rendered inside a react-hook-form <FormProvider> whose values have `password` and
 * `confirmPassword`; it reads the form from context so each form does not repeat this wiring.
 */
export function PasswordWithConfirm({
  passwordLabel = "Password",
  confirmLabel = "Confirm password",
  readOnly,
  showRequirements = true,
  layout = "stacked",
}: PasswordWithConfirmProps) {
  const { register, control, trigger, getFieldState, formState } = useFormContext<PasswordPair>();
  const { errors } = formState;
  const password = useWatch({ control, name: "password" }) ?? "";
  const confirmPassword = useWatch({ control, name: "confirmPassword" }) ?? "";
  const passwordsMatch = confirmPassword !== "" && confirmPassword === password;
  const split = layout === "split";

  const passwordField = (
    <PasswordField
      label={passwordLabel}
      autoComplete="new-password"
      readOnly={readOnly}
      error={errors.password?.message}
      {...register("password", {
        // Changing the password can break or fix a confirm field the user already filled in.
        onChange: () => {
          if (getFieldState("confirmPassword", formState).isTouched) void trigger("confirmPassword");
        },
      })}
    />
  );

  const confirmField = (
    <PasswordField
      label={confirmLabel}
      autoComplete="new-password"
      readOnly={readOnly}
      error={errors.confirmPassword?.message}
      hint={
        passwordsMatch && !errors.confirmPassword ? (
          <span className="flex items-center gap-1.5 text-success">
            <Check aria-hidden="true" className="size-3.5" />
            Passwords match
          </span>
        ) : undefined
      }
      {...register("confirmPassword")}
    />
  );

  const requirements = showRequirements && (
    <PasswordRequirements password={password} columns={split ? 3 : 2} />
  );

  if (split) {
    return (
      <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
        {passwordField}
        {confirmField}
        {requirements && <div className="sm:col-span-2">{requirements}</div>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {passwordField}
      {requirements}
      {confirmField}
    </div>
  );
}
