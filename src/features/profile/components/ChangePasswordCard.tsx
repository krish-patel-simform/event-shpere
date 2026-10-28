"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Alert, Button, Card, PasswordField } from "@/src/core/ui";
import {
  changePasswordFormSchema,
  type ChangePasswordFormValues,
} from "../schemas/profile.schemas";
import { SAMPLE_SAVED_NOTE } from "../utils/profile.sample";

type ChangePasswordCardProps = {
  /** False when the person may not change their password (no PROFILE_MANAGE). */
  canEdit: boolean;
  /** Gets the checked values. The default does nothing: nothing is sent to a server yet. */
  onSubmit?: (values: ChangePasswordFormValues) => void | Promise<void>;
};

const EMPTY_VALUES: ChangePasswordFormValues = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

/** Current password, new password and its confirmation. */
export function ChangePasswordCard({
  canEdit,
  onSubmit = () => undefined,
}: ChangePasswordCardProps) {
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordFormSchema),
    defaultValues: EMPTY_VALUES,
  });

  const submit = handleSubmit(async (values) => {
    setSaved(false);
    setFailed(false);
    try {
      await onSubmit(values);
      // Never keep a password in the form after it was used.
      reset(EMPTY_VALUES);
      setSaved(true);
    } catch {
      setFailed(true);
    }
  });

  return (
    <Card
      title="Change password"
      description="Choose a new password for signing in"
    >
      {canEdit ? (
        <form noValidate onSubmit={submit} className="max-w-lg space-y-4">
          {saved && (
            <Alert tone="success" title={SAMPLE_SAVED_NOTE}>
              Your real password is unchanged: this page does not talk to the
              server yet.
            </Alert>
          )}
          {failed && (
            <Alert tone="error" title="We couldn't change your password">
              Nothing was changed. Try again in a moment.
            </Alert>
          )}
          <PasswordField
            label="Current password"
            autoComplete="current-password"
            error={errors.currentPassword?.message}
            readOnly={isSubmitting}
            {...register("currentPassword")}
          />
          <PasswordField
            label="New password"
            autoComplete="new-password"
            hint="At least 8 characters, with an uppercase letter, a lowercase letter, a number and a special character."
            error={errors.newPassword?.message}
            readOnly={isSubmitting}
            {...register("newPassword")}
          />
          <PasswordField
            label="Confirm new password"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            readOnly={isSubmitting}
            {...register("confirmPassword")}
          />
          <Button type="submit" isPending={isSubmitting}>
            {isSubmitting ? "Updating…" : "Update password"}
          </Button>
        </form>
      ) : (
        <Alert tone="info">Your account cannot change its password here.</Alert>
      )}
    </Card>
  );
}
