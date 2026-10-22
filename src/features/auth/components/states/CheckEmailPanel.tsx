"use client";

import { Mail } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Alert, Button, buttonStyles } from "@/src/core/ui";
import { useResendOtp } from "../../hooks/useResendOtp";
import { AUTH_ROUTES, SITE_ROUTES } from "../../routes";
import { AuthAlert } from "./AuthAlert";
import type { PendingVerification } from "@/src/redux/slices/auth-flow.slice";

const STEPS = [
  {
    title: "Open the email from EventSphere",
    text: "Can't see it? Check your spam or promotions folder.",
  },
  {
    title: "Select “Verify email”",
    text: "The link opens a verification page in your browser.",
  },
  { title: "Enter the 6-digit code", text: "The code is in the same email." },
] as const;

type CheckEmailPanelProps = {
  pending: PendingVerification;
  /** Called when the user says the address was wrong: forget it and go back to signup. */
  onStartAgain: () => void;
};

/**
 * "Check your email" content: what was sent, what to do next, and the way out. "Resend code" calls
 * POST /api/auth/resend-otp for the stored address. The server answers the same way whether or
 * not the account exists, so the message after it never claims the email was delivered.
 */
export function CheckEmailPanel({
  pending,
  onStartAgain,
}: CheckEmailPanelProps) {
  const { email, verificationEmailSent, expiresInMinutes } = pending;
  const resendOtp = useResendOtp();
  const alertRef = useRef<HTMLDivElement>(null);

  // After a failed resend, move focus to the alert so it is read out.
  useEffect(() => {
    if (resendOtp.error) alertRef.current?.focus();
  }, [resendOtp.error]);

  const resend = () => resendOtp.mutate({ email });

  return (
    <div className="space-y-5">
      <span className="grid size-14 place-items-center rounded-full bg-brand-soft text-brand-soft-foreground">
        <Mail aria-hidden="true" className="size-6" />
      </span>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Check your email</h1>
        {verificationEmailSent && (
          <p className="text-muted">
            We sent a 6-digit code and a link to{" "}
            <strong className="break-words text-foreground">{email}</strong>. It
            expires in{" "}
            <strong className="text-foreground">
              {expiresInMinutes} minutes
            </strong>
            .
          </p>
        )}
      </div>

      {verificationEmailSent ? (
        <ol className="space-y-3 rounded-lg border border-line bg-surface-subtle p-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-brand-soft-foreground">
                {index + 1}
              </span>
              <div>
                <p className="text-sm font-semibold">{step.title}</p>
                <p className="text-sm text-muted">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <Alert tone="warning" title="We couldn't send the verification email">
          Your account was created, but the email to{" "}
          <strong className="break-words">{email}</strong> didn&apos;t go out.
          Please{" "}
          <Link href={SITE_ROUTES.support} className="font-semibold underline">
            contact support
          </Link>{" "}
          to verify your address.
        </Alert>
      )}

      {resendOtp.error && (
        <AuthAlert ref={alertRef} error={resendOtp.error} onRetry={resend} />
      )}
      {resendOtp.isSuccess && (
        <Alert tone="success">
          If your signup is still waiting, we&apos;ve sent a new code and link
          to <strong className="break-words">{email}</strong>. Only the newest
          email works.
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href={AUTH_ROUTES.login}
          className={buttonStyles({ variant: "secondary" })}
        >
          Back to log in
        </Link>
        <Button
          variant="secondary"
          onClick={resend}
          isPending={resendOtp.isPending}
        >
          {resendOtp.isPending ? "Sending…" : "Resend code"}
        </Button>
      </div>

      <p className="text-sm text-muted">
        Used the wrong email address?{" "}
        <Link
          href={AUTH_ROUTES.signup}
          onClick={onStartAgain}
          className="font-semibold text-link underline"
        >
          Start again
        </Link>
      </p>
    </div>
  );
}
