"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { Button, FormSection, TextField } from "@/src/core/ui";
import { useAppDispatch } from "@/src/redux/store";
import { verificationStarted } from "@/src/redux/slices/auth-flow.slice";
import { useOrganizerSignup } from "../../hooks/useOrganizerSignup";
import { AUTH_ROUTES, SITE_ROUTES } from "../../routes";
import {
  organizerSignupBodySchema,
  type OrganizerSignupBody,
} from "../../schemas/auth.schemas";
import { emptyToUndefined } from "../../utils/form-values";
import { PasswordWithConfirm } from "../fields/PasswordWithConfirm";
import { AuthAlert } from "../states/AuthAlert";

// The fields a server error can be pinned to; any other failure goes to the alert.
const FIELDS = [
  "firstName",
  "lastName",
  "email",
  "organizationName",
  "organizationWebsite",
  "password",
  "confirmPassword",
] as const satisfies readonly (keyof OrganizerSignupBody)[];

/**
 * Organizer application form, AUTH-1. Validates with the same Zod schema the server uses, then
 * calls POST /api/auth/signup/organizer. On success it remembers the address for the check-email
 * screen (the session only starts at login, after the email is verified).
 */
export function OrganizerSignupForm() {
  const organizerSignup = useOrganizerSignup();
  const alertRef = useRef<HTMLDivElement>(null);
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
    setError,
    formState: { errors },
  } = methods;

  // After a failed submit, move focus to the alert so it is read out.
  useEffect(() => {
    if (organizerSignup.error) alertRef.current?.focus();
  }, [organizerSignup.error]);

  const onSubmit = handleSubmit((values) => {
    organizerSignup.mutate(values, {
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
  const { isPending, error } = organizerSignup;
  // Errors pinned to a field show under it; everything else (network, 5xx, rate limit) here.
  const isFieldError =
    error?.code === "EMAIL_TAKEN" ||
    FIELDS.some((field) => error?.fieldErrors[field]);

  return (
    <FormProvider {...methods}>
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {error && !isFieldError && (
          <AuthAlert ref={alertRef} error={error} onRetry={onSubmit} />
        )}

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
              {...register("organizationWebsite", {
                setValueAs: emptyToUndefined,
              })}
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
