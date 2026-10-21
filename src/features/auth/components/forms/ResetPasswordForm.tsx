"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { Button } from "@/src/core/ui";
import { useResetPassword } from "../../hooks/useResetPassword";
import {
  resetPasswordBodySchema,
  type ResetPasswordBody,
} from "../../schemas/auth.schemas";
import { PasswordWithConfirm } from "../fields/PasswordWithConfirm";
import { AuthAlert } from "../states/AuthAlert";

type ResetPasswordFormProps = {
  /** The one-time token from the reset link (?token=...). */
  token: string;
  /** The password was changed. */
  onDone: () => void;
  /** The server says the link is expired or already used (fieldErrors.token). */
  onLinkInvalid: () => void;
};

/**
 * The "choose a new password" form (AUTH-7). Validates with the same Zod schema as the API, then
 * calls POST /api/auth/reset-password. What happens after the result is up to the screen
 * (onDone / onLinkInvalid).
 */
export function ResetPasswordForm({
  token,
  onDone,
  onLinkInvalid,
}: ResetPasswordFormProps) {
  const resetPassword = useResetPassword();
  const alertRef = useRef<HTMLDivElement>(null);
  const methods = useForm<ResetPasswordBody>({
    resolver: zodResolver(resetPasswordBodySchema),
    mode: "onBlur", // field errors appear when the user leaves a field, as on the set-password page
    defaultValues: { token, password: "", confirmPassword: "" },
  });
  const { handleSubmit, setError } = methods;

  // After a failed submit, move focus to the alert so it is read out.
  useEffect(() => {
    if (resetPassword.error) alertRef.current?.focus();
  }, [resetPassword.error]);

  const onSubmit = handleSubmit((values) => {
    resetPassword.mutate(values, {
      onSuccess: onDone,
      onError: (error) => {
        const { fieldErrors } = error;
        // Expired or used link: the form cannot work any more, so the screen replaces it.
        if (fieldErrors.token) return onLinkInvalid();
        // e.g. the new password is the same as the current one.
        if (fieldErrors.password) {
          setError("password", { message: fieldErrors.password[0] });
        }
        if (fieldErrors.confirmPassword) {
          setError("confirmPassword", {
            message: fieldErrors.confirmPassword[0],
          });
        }
      },
    });
  });
  const { isPending, error } = resetPassword;
  // Field errors are shown under their fields; everything else (network, 5xx) in the alert.
  const showAlert =
    error && !error.fieldErrors.password && !error.fieldErrors.confirmPassword;

  return (
    <FormProvider {...methods}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {showAlert && (
          <AuthAlert ref={alertRef} error={error} onRetry={onSubmit} />
        )}

        <PasswordWithConfirm
          passwordLabel="New password"
          confirmLabel="Confirm new password"
          readOnly={isPending}
        />

        <Button type="submit" fullWidth isPending={isPending}>
          {isPending ? "Resetting…" : "Reset password"}
        </Button>
        <p className="text-xs text-muted">
          For your security, resetting your password logs you out everywhere.
        </p>
      </form>
    </FormProvider>
  );
}
