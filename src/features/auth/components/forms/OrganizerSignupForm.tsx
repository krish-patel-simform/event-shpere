"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormProvider, useForm } from "react-hook-form";
import type { ApiError } from "@/src/core/api-client/base-api.service";
import { Button, FormSection, TextField } from "@/src/core/ui";
import { useAppDispatch } from "@/src/redux/store";
import { AUTH_ROUTES, SITE_ROUTES } from "../../routes";
import { organizerSignupBodySchema, type OrganizerSignupBody } from "../../schemas/auth.schemas";
import { verificationStarted } from "../../store/auth-flow.slice";
import { emptyToUndefined } from "../../utils/form-values";
import { PasswordWithConfirm } from "../fields/PasswordWithConfirm";
import { AuthAlert } from "../states/AuthAlert";

// TODO(API): replace this stub with useOrganizerSignup(). On success, dispatch verificationStarted with
// the response (email, verificationEmailSent, verificationCodeExpiresInMinutes) and go to
// check-email, as the stub below does with made-up values. An email ending in "@fail.test"
// pretends the verification email could not be sent, so that screen state can be reviewed.
const signup = {
  isPending: false,
  error: null as ApiError | null,
};

/** Organizer application form, AUTH-1. Validates with the same Zod schema the server uses. */
export function OrganizerSignupForm() {
  const methods = useForm<OrganizerSignupBody>({
    resolver: zodResolver(organizerSignupBodySchema),
    mode: "onBlur", // field errors appear when the user leaves a field, as in the design
    // organizationWebsite is left out on purpose: see emptyToUndefined below.
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      organizationName: "",
      password: "",
      confirmPassword: "",
    },
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
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {signup.error && <AuthAlert error={signup.error} onRetry={onSubmit} />}

        <FormSection title="About you">
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
            <TextField
              label="First name"
              autoComplete="given-name"
              readOnly={isPending}
              error={errors.firstName?.message}
              {...register("firstName")}
            />
            <TextField
              label="Last name"
              autoComplete="family-name"
              readOnly={isPending}
              error={errors.lastName?.message}
              {...register("lastName")}
            />
          </div>
          <TextField
            label="Work email"
            type="email"
            autoComplete="email"
            placeholder="name@organisation.com"
            readOnly={isPending}
            error={errors.email?.message}
            {...register("email")}
          />
        </FormSection>

        <FormSection title="Your organisation">
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
            <TextField
              label="Organisation name"
              autoComplete="organization"
              readOnly={isPending}
              error={errors.organizationName?.message}
              {...register("organizationName")}
            />
            <TextField
              label="Website"
              optional
              type="url"
              autoComplete="url"
              placeholder="https://"
              hint="Helps our team verify your organisation faster."
              readOnly={isPending}
              error={errors.organizationWebsite?.message}
              {...register("organizationWebsite", { setValueAs: emptyToUndefined })}
            />
          </div>
        </FormSection>

        <FormSection title="Password">
          <PasswordWithConfirm layout="split" readOnly={isPending} />
        </FormSection>

        <div className="space-y-3">
          <Button type="submit" fullWidth isPending={isPending}>
            {isPending ? "Submitting application…" : "Submit application"}
          </Button>
          <p className="text-center text-xs text-muted">
            By applying you agree to our{" "}
            <Link href={SITE_ROUTES.organizerTerms} className="underline">
              Organizer terms
            </Link>{" "}
            and{" "}
            <Link href={SITE_ROUTES.privacy} className="underline">
              Privacy policy
            </Link>
            .
          </p>
        </div>
      </form>
    </FormProvider>
  );
}
