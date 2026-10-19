"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useLogin } from "../hooks/useLogin";
import { loginBodySchema, type LoginBody } from "../schemas/auth.schemas";

/** Step 2 of the setup email (and the normal login). */
export function LoginForm() {
  const login = useLogin();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginBody>({
    resolver: zodResolver(loginBodySchema),
    defaultValues: { email: "", password: "" },
  });

  function onSubmit(values: LoginBody) {
    login.mutate(values, {
      // Wrong password, PASSWORD_NOT_SET, ACCOUNT_SUSPENDED: the server's message says which.
      onError: ({ message }) => setError("root", { message }),
    });
  }
  const isSubmitting = login.isPending;
  const signedIn = login.data;

  // No dashboard yet: confirm who signed in. Replace with a redirect once pages exist.
  if (signedIn) {
    return (
      <p role="status" className="rounded-md bg-green-50 p-3 text-sm text-green-800">
        Signed in as {signedIn.firstName} {signedIn.lastName} ({signedIn.role}).
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {errors.root && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {errors.root.message}
        </p>
      )}

      <div className="space-y-1">
        <label htmlFor="email" className="block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "email-error" : undefined}
          className="w-full rounded-md border px-3 py-2"
          {...register("email")}
        />
        {errors.email && (
          <p id="email-error" className="text-sm text-red-700">
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="password" className="block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? "password-error" : undefined}
          className="w-full rounded-md border px-3 py-2"
          {...register("password")}
        />
        {errors.password && (
          <p id="password-error" className="text-sm text-red-700">
            {errors.password.message}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {isSubmitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
