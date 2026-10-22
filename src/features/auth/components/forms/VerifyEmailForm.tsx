"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldCheck } from "lucide-react";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { Badge, Button, TextField } from "@/src/core/ui";
import { useVerifyEmail } from "../../hooks/useVerifyEmail";
import {
  verifyEmailBodySchema,
  type VerifyEmailBody,
} from "../../schemas/auth.schemas";
import { AuthAlert } from "../states/AuthAlert";

type VerifyEmailFormProps = {
  /** The one-time token from the emailed link (?token=...). */
  token: string;
  /** Called once the code is accepted. */
  onVerified: () => void;
  /** The server says the link is expired or already used (fieldErrors.token). */
  onLinkInvalid: () => void;
};

/**
 * The code form, AUTH-1. The token comes from the link; the user types the 6-digit code. Calls
 * POST /api/auth/verify-email; a wrong or expired code shows under the field, a bad link is
 * handed to the screen (onLinkInvalid).
 */
export function VerifyEmailForm({
  token,
  onVerified,
  onLinkInvalid,
}: VerifyEmailFormProps) {
  const verifyEmail = useVerifyEmail();
  const alertRef = useRef<HTMLDivElement>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<VerifyEmailBody>({
    resolver: zodResolver(verifyEmailBodySchema),
    defaultValues: { token, otp: "" },
  });

  // After a failed submit, move focus to the alert so it is read out.
  useEffect(() => {
    if (verifyEmail.error) alertRef.current?.focus();
  }, [verifyEmail.error]);

  const onSubmit = handleSubmit((values) => {
    verifyEmail.mutate(values, {
      onSuccess: onVerified,
      onError: (error) => {
        const { fieldErrors } = error;
        // Expired or used link: the form cannot work any more, so the screen replaces it.
        if (fieldErrors.token) return onLinkInvalid();
        // Wrong or expired code: the user can type it again.
        if (fieldErrors.otp) setError("otp", { message: fieldErrors.otp[0] });
      },
    });
  });
  const { isPending, error } = verifyEmail;
  // A wrong code shows under the field; everything else (network, 5xx, rate limit) here.
  const showAlert = error && !error.fieldErrors.otp;

  return (
    <div className="space-y-5">
      <span className="grid size-14 place-items-center rounded-full bg-brand-soft text-brand-soft-foreground">
        <ShieldCheck aria-hidden="true" className="size-6" />
      </span>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Verify your email</h1>
        <p className="text-muted">
          Enter the 6-digit code from the email we sent you.
        </p>
      </div>

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {showAlert && (
          <AuthAlert ref={alertRef} error={error} onRetry={onSubmit} />
        )}

        <TextField
          label="Verification code"
          size="lg"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="• • • • • •"
          inputClassName="text-center font-mono tracking-[0.4em]"
          hint="6 digits, numbers only. After 5 incorrect tries you'll need a new code."
          readOnly={isPending}
          error={errors.otp?.message}
          {...register("otp", {
            // Keep digits only, so a pasted "123 456" or "123-456" still works.
            onChange: (event) => {
              event.target.value = event.target.value.replace(/\D/g, "");
            },
          })}
        />

        <Button type="submit" fullWidth isPending={isPending}>
          {isPending ? "Verifying…" : "Verify email"}
        </Button>
      </form>

      <div className="flex items-center justify-between gap-3 border-t border-line pt-4 text-sm text-muted">
        <span>Didn&apos;t get a code?</span>
        {/* Resending is not built yet. */}
        <span className="flex items-center gap-2">
          Resend code <Badge>Soon</Badge>
        </span>
      </div>
    </div>
  );
}
