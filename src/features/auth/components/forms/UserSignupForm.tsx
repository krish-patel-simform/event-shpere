"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormProvider, useForm } from "react-hook-form";
import type { ApiError } from "@/src/core/api-client/base-api.service";
import { Button, FormSection, TextField } from "@/src/core/ui";
import { useAppDispatch } from "@/src/redux/store";
import { verificationStarted } from "@/src/redux/slices/auth-flow.slice";
import { AUTH_ROUTES, SITE_ROUTES } from "../../routes";
import { userSignupBodySchema, type UserSignupBody } from "../../schemas/auth.schemas";
import { emptyToUndefined } from "../../utils/form-values";
import { PasswordWithConfirm } from "../fields/PasswordWithConfirm";
import { AuthAlert } from "../states/AuthAlert";

// TODO(API): replace this stub with useUserSignup(). On success, dispatch verificationStarted with
// the response (email, verificationEmailSent, verificationCodeExpiresInMinutes) and go to
// check-email, as the stub below does with made-up values. An email ending in "@fail.test"
// pretends the verification email could not be sent, so that screen state can be reviewed.
const signup = {
  isPending: false,
  error: null as ApiError | null,
};

/** User (attendee) signup form, AUTH-1. Validates with the same Zod schema the server uses. */
export function UserSignupForm() {
  const methods = useForm<UserSignupBody>({
    resolver: zodResolver(userSignupBodySchema),
    mode: "onBlur", // field errors appear when the user leaves a field, as in the design
    // The optional fields are left out on purpose: see emptyToUndefined below.
    defaultValues: { firstName: "", lastName: "", email: "", password: "", confirmPassword: "" },
  });
  const router = useRouter();
  const dispatch = useAppDispatch();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = methods;

  const onSubmit = handleSubmit((values) => {
    dispatch(
      verificationStarted({
        email: values.email,
        verificationEmailSent: !values.email.endsWith("@fail.test"),
        expiresInMinutes: 5,
      }),
    );
    router.push(AUTH_ROUTES.checkEmail);
  });
  const isPending = signup.isPending;

  return (
    <FormProvider {...methods}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {signup.error && <AuthAlert error={signup.error} onRetry={onSubmit} />}

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
          <TextField
            label="Profile photo URL"
            optional
            type="url"
            autoComplete="off"
            placeholder="https://"
            hint="A full https:// link to an image. Photo upload is coming soon."
            readOnly={isPending}
            error={errors.avatarUrl?.message}
            {...register("avatarUrl", { setValueAs: emptyToUndefined })}
          />
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
