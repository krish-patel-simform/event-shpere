"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { Button, FormSection, TextField } from "@/src/core/ui";
import { useAppDispatch } from "@/src/redux/store";
import { verificationStarted } from "@/src/redux/slices/auth-flow.slice";
import { useUserSignup } from "../../hooks/useUserSignup";
import { AUTH_ROUTES, SITE_ROUTES } from "../../routes";
import {
  userSignupBodySchema,
  type UserSignupBody,
} from "../../schemas/auth.schemas";
import { emptyToUndefined } from "../../utils/form-values";
import { PasswordWithConfirm } from "../fields/PasswordWithConfirm";
import { AuthAlert } from "../states/AuthAlert";

// The fields a server error can be pinned to; any other failure goes to the alert.
// No profile photo here: it is added later in the profile (upload, then its public link).
const FIELDS = [
  "firstName",
  "lastName",
  "email",
  "password",
  "confirmPassword",
  "phone",
  "city",
  "postalCode",
] as const satisfies readonly (keyof UserSignupBody)[];

/**
 * User (attendee) signup form, AUTH-1. Validates with the same Zod schema the server uses, then
 * calls POST /api/auth/signup/user. On success it remembers the address for the check-email
 * screen (the session only starts at login, after the email is verified).
 */
export function UserSignupForm() {
  const userSignup = useUserSignup();
  const alertRef = useRef<HTMLDivElement>(null);
  const methods = useForm<UserSignupBody>({
    resolver: zodResolver(userSignupBodySchema),
    mode: "onBlur", // field errors appear when the user leaves a field, as in the design
    // The optional fields are left out on purpose: see emptyToUndefined below.
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });
  const router = useRouter();
  const dispatch = useAppDispatch();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = methods;

  // After a failed submit, move focus to the alert so it is read out.
  useEffect(() => {
    if (userSignup.error) alertRef.current?.focus();
  }, [userSignup.error]);

  const onSubmit = handleSubmit((values) => {
    userSignup.mutate(values, {
      onSuccess: (account) => {
        dispatch(
          verificationStarted({
            email: account.email,
            verificationEmailSent: account.verificationEmailSent,
            expiresInMinutes: account.verificationCodeExpiresInMinutes,
          }),
        );
        router.push(AUTH_ROUTES.checkEmail);
      },
      onError: (error) => {
        // Taken email: pin it to the field. Keep every value so the user can fix just that.
        if (error.code === "EMAIL_TAKEN") {
          return setError("email", { message: error.message });
        }
        for (const field of FIELDS) {
          const message = error.fieldErrors[field]?.[0];
          if (message) setError(field, { message });
        }
      },
    });
  });
  const { isPending, error } = userSignup;
  // Errors pinned to a field show under it; everything else (network, 5xx, rate limit) here.
  const isFieldError =
    error?.code === "EMAIL_TAKEN" ||
    FIELDS.some((field) => error?.fieldErrors[field]);

  return (
    <FormProvider {...methods}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {error && !isFieldError && (
          <AuthAlert ref={alertRef} error={error} onRetry={onSubmit} />
        )}

        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
          <TextField
            label="First name"
            autoComplete="given-name"
            placeholder="Ananya"
            readOnly={isPending}
            error={errors.firstName?.message}
            {...register("firstName")}
          />
          <TextField
            label="Last name"
            autoComplete="family-name"
            placeholder="Rao"
            readOnly={isPending}
            error={errors.lastName?.message}
            {...register("lastName")}
          />
        </div>

        <TextField
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="name@example.com"
          readOnly={isPending}
          error={errors.email?.message}
          {...register("email")}
        />

        <PasswordWithConfirm layout="split" readOnly={isPending} />

        <FormSection
          variant="box"
          title="Optional details"
          description="Leave blank anything you'd rather not share. You can add it later in your profile."
        >
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-3">
            <TextField
              label="Phone"
              optional
              type="tel"
              autoComplete="tel"
              placeholder="555-123-4567"
              hint="Format: 555-123-4567"
              readOnly={isPending}
              error={errors.phone?.message}
              {...register("phone", { setValueAs: emptyToUndefined })}
            />
            <TextField
              label="City"
              optional
              autoComplete="address-level2"
              readOnly={isPending}
              error={errors.city?.message}
              {...register("city", { setValueAs: emptyToUndefined })}
            />
            <TextField
              label="Postal code"
              optional
              autoComplete="postal-code"
              readOnly={isPending}
              error={errors.postalCode?.message}
              {...register("postalCode", { setValueAs: emptyToUndefined })}
            />
          </div>
        </FormSection>

        <Button type="submit" fullWidth isPending={isPending}>
          {isPending ? "Creating account…" : "Create account"}
        </Button>

        <p className="text-center text-xs text-muted">
          By creating an account you agree to our{" "}
          <Link href={SITE_ROUTES.terms} className="underline">
            Terms of use
          </Link>{" "}
          and{" "}
          <Link href={SITE_ROUTES.privacy} className="underline">
            Privacy policy
          </Link>
          .
        </p>
      </form>
    </FormProvider>
  );
}
