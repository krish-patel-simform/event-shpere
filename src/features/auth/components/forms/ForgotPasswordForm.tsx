"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { Button, TextField } from "@/src/core/ui";
import { useForgotPassword } from "../../hooks/useForgotPassword";
import {
  forgotPasswordBodySchema,
  type ForgotPasswordBody,
} from "../../schemas/auth.schemas";
import { AuthAlert } from "../states/AuthAlert";

type ForgotPasswordFormProps = {
  /** The server accepted the request. The screen decides what happens next. */
  onDone: (email: string) => void;
};

/**
 * The "email me a reset link" form (AUTH-6). Validates with the same Zod schema as the API, then
 * calls POST /api/auth/forgot-password. The server answers the same way whether or not the
 * account exists, so success never says anything about it.
 */
export function ForgotPasswordForm({ onDone }: ForgotPasswordFormProps) {
  const forgotPassword = useForgotPassword();
  const alertRef = useRef<HTMLDivElement>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ForgotPasswordBody>({
    resolver: zodResolver(forgotPasswordBodySchema),
    defaultValues: { email: "" },
  });

  // After a failed submit, move focus to the alert so it is read out.
  useEffect(() => {
    if (forgotPassword.error) alertRef.current?.focus();
  }, [forgotPassword.error]);

  const onSubmit = handleSubmit((values) => {
    forgotPassword.mutate(values, {
      onSuccess: () => onDone(values.email),
      onError: (error) => {
        // e.g. an admin account: the server rejects the email itself.
        if (error.fieldErrors.email) {
          setError("email", { message: error.fieldErrors.email[0] });
        }
      },
    });
  });
  const { isPending, error } = forgotPassword;
  // A field error is shown under the field; everything else (network, 5xx, rate limit) here.
  const showAlert = error && !error.fieldErrors.email;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {showAlert && (
        <AuthAlert ref={alertRef} error={error} onRetry={onSubmit} />
      )}

      <TextField
        label="Email address"
        type="email"
        autoComplete="email"
        placeholder="name@company.com"
        readOnly={isPending}
        error={errors.email?.message}
        {...register("email")}
      />

      <Button type="submit" fullWidth isPending={isPending}>
        {isPending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
