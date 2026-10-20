"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import type { ApiError } from "@/src/core/api-client/base-api.service";
import { Badge, Button, TextField } from "@/src/core/ui";
import { verifyEmailBodySchema, type VerifyEmailBody } from "../../schemas/auth.schemas";
import { AuthAlert } from "../states/AuthAlert";

type VerifyEmailFormProps = {
  /** The one-time token from the emailed link (?token=...). */
  token: string;
  /** Called once the code is accepted. */
  onVerified: () => void;
};

// TODO(API): replace this stub with useVerifyEmail() (POST /api/auth/verify-email). It will
// also map the server's fieldErrors.otp to the code field and fieldErrors.token to the
// "invalid link" screen. The stub accepts any 6 digits except 000000, so the error state can be seen.
const WRONG_CODE_MESSAGE = "The code is incorrect or has expired. Check your email and try again.";
const verify = {
  isPending: false,
  error: null as ApiError | null,
};

/** The code form, AUTH-1. The token comes from the link; the user types the 6-digit code. */
export function VerifyEmailForm({ token, onVerified }: VerifyEmailFormProps) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<VerifyEmailBody>({
    resolver: zodResolver(verifyEmailBodySchema),
    defaultValues: { token, otp: "" },
  });

  const onSubmit = handleSubmit((values) => {
    if (values.otp === "000000") {
      setError("otp", { message: WRONG_CODE_MESSAGE });
      return;
    }
    onVerified();
  });
  const isPending = verify.isPending;

  return (
    <div className="space-y-5">
      <span className="grid size-14 place-items-center rounded-full bg-brand-soft text-brand-soft-foreground">
        <ShieldCheck aria-hidden="true" className="size-6" />
      </span>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Verify your email</h1>
        <p className="text-muted">Enter the 6-digit code from the email we sent you.</p>
      </div>

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {verify.error && <AuthAlert error={verify.error} onRetry={onSubmit} />}

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
