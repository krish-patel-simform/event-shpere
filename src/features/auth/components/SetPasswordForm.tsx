"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { useCompleteAccountSetup } from "../hooks/useCompleteAccountSetup";
import {
  accountSetupBodySchema,
  type AccountSetupBody,
} from "../schemas/auth.schemas";

type Props = { token: string };

/** Step 1 of the setup email. On success, shows a confirmation with a link to log in (step 2). */
export function SetPasswordForm({ token }: Props) {
  const completeAccountSetup = useCompleteAccountSetup();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<AccountSetupBody>({
    // The same Zod schema the API validates with: identical rules in both places.
    resolver: zodResolver(accountSetupBodySchema),
    defaultValues: { token, password: "", confirmPassword: "" },
  });

  function onSubmit(values: AccountSetupBody) {
    completeAccountSetup.mutate(values, {
      onError: ({ fieldErrors, message }) => {
        if (fieldErrors.password) {
          setError("password", { message: fieldErrors.password[0] });
        }
        if (fieldErrors.confirmPassword) {
          setError("confirmPassword", {
            message: fieldErrors.confirmPassword[0],
          });
        }
        // Expired/used link, network failure, anything else: shown above the form.
        if (!fieldErrors.password && !fieldErrors.confirmPassword) {
          setError("root", { message });
        }
      },
    });
  }
  const isSubmitting = completeAccountSetup.isPending;

  // Done: the form is replaced by a confirmation and the way to step 2.
  if (completeAccountSetup.isSuccess) {
    return (
      <div
        role="status"
        className="space-y-3 rounded-md bg-green-50 p-4 text-green-800"
      >
        <p className="font-medium">Your password is set.</p>
        <p className="text-sm">
          You can now log in with your email and new password.
        </p>
        <Link
          href="/login"
          className="inline-block rounded-md bg-black px-4 py-2 text-sm text-white"
        >
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {(errors.root ?? errors.token) && (
        <p
          role="alert"
          className="rounded-md bg-red-50 p-3 text-sm text-red-700"
        >
          {errors.root?.message ?? errors.token?.message}
        </p>
      )}

      <div className="space-y-1">
        <label htmlFor="password" className="block text-sm font-medium">
          New password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.password}
          aria-describedby={
            errors.password ? "password-error" : "password-hint"
          }
          className="w-full rounded-md border px-3 py-2"
          {...register("password")}
        />
        {errors.password ? (
          <p id="password-error" className="text-sm text-red-700">
            {errors.password.message}
          </p>
        ) : (
          <p id="password-hint" className="text-sm text-gray-600">
            At least 8 characters.
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="confirmPassword" className="block text-sm font-medium">
          Confirm password
        </label>
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.confirmPassword}
          aria-describedby={
            errors.confirmPassword ? "confirm-error" : undefined
          }
          className="w-full rounded-md border px-3 py-2"
          {...register("confirmPassword")}
        />
        {errors.confirmPassword && (
          <p id="confirm-error" className="text-sm text-red-700">
            {errors.confirmPassword.message}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {isSubmitting ? "Setting password…" : "Set password"}
      </button>
    </form>
  );
}
