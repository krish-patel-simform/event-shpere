"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { Alert, Button, PasswordField, TextField } from "@/src/core/ui";
import { useLogin } from "../../hooks/useLogin";
import { AUTH_ROUTES } from "../../routes";
import { loginBodySchema, type LoginBody } from "../../schemas/auth.schemas";
import { AuthAlert } from "../states/AuthAlert";

/** The login form (AUTH-2): validates with the shared Zod schema, then calls POST /api/auth/login. */
export function LoginForm() {
  const login = useLogin();
  const alertRef = useRef<HTMLDivElement>(null);
  const {
    register,
    handleSubmit,
    resetField,
    formState: { errors },
  } = useForm<LoginBody>({
    resolver: zodResolver(loginBodySchema),
    defaultValues: { email: "", password: "" },
  });

  // After a failed login, move focus to the alert so it is read out.
  useEffect(() => {
    if (login.error) alertRef.current?.focus();
  }, [login.error]);

  const onSubmit = handleSubmit((values) => {
    login.mutate(values, {
      // Wrong details: keep the email, clear the password. Any other failure (network, 5xx,
      // not verified...) keeps both values so "Try again" can resubmit them.
      onError: (error) => {
        if (error.code === "UNAUTHENTICATED") resetField("password");
      },
    });
  });
  const isPending = login.isPending;

  // No dashboard yet: confirm who signed in. Replace with a redirect once the app pages exist.
  if (login.data) {
    return (
      <Alert tone="success">
        Signed in as {login.data.firstName} {login.data.lastName} (
        {login.data.role}).
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {login.error && (
        <AuthAlert ref={alertRef} error={login.error} onRetry={onSubmit} />
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

      <PasswordField
        label="Password"
        autoComplete="current-password"
        placeholder="Enter your password"
        readOnly={isPending}
        error={errors.password?.message}
        labelAction={
          <Link
            href={AUTH_ROUTES.forgotPassword}
            className="text-sm font-semibold text-link underline"
          >
            Forgot password?
          </Link>
        }
        {...register("password")}
      />

      <Button type="submit" fullWidth isPending={isPending}>
        {isPending ? "Logging in…" : "Log in"}
      </Button>
    </form>
  );
}
