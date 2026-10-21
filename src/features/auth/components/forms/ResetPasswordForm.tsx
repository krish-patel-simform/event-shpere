"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm } from "react-hook-form";
import { Button } from "@/src/core/ui";
import {
  resetPasswordBodySchema,
  type ResetPasswordBody,
} from "../../schemas/auth.schemas";
import { PasswordWithConfirm } from "../fields/PasswordWithConfirm";

type ResetPasswordFormProps = {
  /** The one-time token from the reset link (?token=...). */
  token: string;
  /** The values passed validation. The screen decides what happens next. */
  onDone: () => void;
};

/**
 * The "choose a new password" form (AUTH-7). Validates with the same Zod schema as the API.
 * UI only for now: nothing is sent yet; the API call (POST /api/auth/reset-password) is added
 * where `onSubmit` is, and its token error will call a new `onLinkInvalid` prop.
 */
export function ResetPasswordForm({ token, onDone }: ResetPasswordFormProps) {
  const methods = useForm<ResetPasswordBody>({
    resolver: zodResolver(resetPasswordBodySchema),
    mode: "onBlur", // field errors appear when the user leaves a field, as on the set-password page
    defaultValues: { token, password: "", confirmPassword: "" },
  });

  const onSubmit = methods.handleSubmit(() => onDone());

  return (
    <FormProvider {...methods}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <PasswordWithConfirm
          passwordLabel="New password"
          confirmLabel="Confirm new password"
        />

        <Button type="submit" fullWidth>
          Reset password
        </Button>
        <p className="text-xs text-muted">
          For your security, resetting your password logs you out everywhere.
        </p>
      </form>
    </FormProvider>
  );
}
