"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { Button } from "@/src/core/ui";
import { useCompleteAccountSetup } from "../../hooks/useCompleteAccountSetup";
import { accountSetupBodySchema, type AccountSetupBody } from "../../schemas/auth.schemas";
import { PasswordWithConfirm } from "../fields/PasswordWithConfirm";
import { AuthAlert } from "../states/AuthAlert";

type SetPasswordFormProps = {
  /** The one-time token from the invitation link (?token=...). */
  token: string;
  /** The password was saved and the account is active. */
  onDone: () => void;
  /** The server says the link is expired or already used (fieldErrors.token). */
  onLinkInvalid: () => void;
};

/**
 * Step 1 of the invitation email: set the first password (AUTH-10). Validates with the same
 * Zod schema as the API. What happens after the result is up to the screen (onDone / onLinkInvalid).
 */
export function SetPasswordForm({ token, onDone, onLinkInvalid }: SetPasswordFormProps) {
  const completeAccountSetup = useCompleteAccountSetup();
  const alertRef = useRef<HTMLDivElement>(null);
  const methods = useForm<AccountSetupBody>({
    resolver: zodResolver(accountSetupBodySchema),
    mode: "onBlur", // field errors appear when the user leaves a field, as in the design
    defaultValues: { token, password: "", confirmPassword: "" },
  });
  const { handleSubmit, setError } = methods;

  // After a failed submit, move focus to the alert so it is read out.
  useEffect(() => {
    if (completeAccountSetup.error) alertRef.current?.focus();
  }, [completeAccountSetup.error]);

  const onSubmit = handleSubmit((values) => {
    completeAccountSetup.mutate(values, {
      onSuccess: onDone,
      onError: (error) => {
        const { fieldErrors } = error;
        // Expired or used link: the form cannot work any more, so the screen replaces it.
        if (fieldErrors.token) return onLinkInvalid();
        if (fieldErrors.password) setError("password", { message: fieldErrors.password[0] });
        if (fieldErrors.confirmPassword) {
          setError("confirmPassword", { message: fieldErrors.confirmPassword[0] });
        }
      },
    });
  });
  const { isPending, error } = completeAccountSetup;
  // Field errors are shown under their fields; everything else (network, 5xx) in the alert.
  const showAlert = error && !error.fieldErrors.password && !error.fieldErrors.confirmPassword;

  return (
    <FormProvider {...methods}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {showAlert && <AuthAlert ref={alertRef} error={error} onRetry={onSubmit} />}

        <PasswordWithConfirm
          passwordLabel="New password"
          confirmLabel="Confirm new password"
          readOnly={isPending}
        />

        <Button type="submit" fullWidth isPending={isPending}>
          {isPending ? "Activating…" : "Activate account"}
        </Button>
        <p className="text-xs text-muted">
          After activating, log in with your email address and this password.
        </p>
      </form>
    </FormProvider>
  );
}
