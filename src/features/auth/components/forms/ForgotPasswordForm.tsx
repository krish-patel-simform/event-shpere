"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button, TextField } from "@/src/core/ui";
import {
  forgotPasswordBodySchema,
  type ForgotPasswordBody,
} from "../../schemas/auth.schemas";

type ForgotPasswordFormProps = {
  /** The email passed validation. The screen decides what happens next. */
  onDone: (email: string) => void;
};

/**
 * The "email me a reset link" form (AUTH-6). Validates with the same Zod schema as the API.
 * UI only for now: nothing is sent yet; the API call (POST /api/auth/forgot-password) is added
 * where `onSubmit` is.
 */
export function ForgotPasswordForm({ onDone }: ForgotPasswordFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordBody>({
    resolver: zodResolver(forgotPasswordBodySchema),
    defaultValues: { email: "" },
  });

  const onSubmit = handleSubmit((values) => onDone(values.email));

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <TextField
        label="Email address"
        type="email"
        autoComplete="email"
        placeholder="name@company.com"
        error={errors.email?.message}
        {...register("email")}
      />

      <Button type="submit" fullWidth>
        Send reset link
      </Button>
    </form>
  );
}
