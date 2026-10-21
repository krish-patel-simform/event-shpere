"use client";

import { Mail } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { buttonStyles } from "@/src/core/ui";
import { PASSWORD_RESET_TOKEN_TTL_MINUTES } from "../../constants";
import { AUTH_ROUTES } from "../../routes";
import { ForgotPasswordForm } from "../forms/ForgotPasswordForm";
import { AuthHeading } from "../shell/AuthHeading";
import { AuthShell } from "../shell/AuthShell";
import { BrandPanel } from "../shell/BrandPanel";
import { StatusPanel } from "../states/StatusPanel";

/**
 * Where "Forgot password?" leads (/forgot-password): ask for the email, then tell the user to
 * check their inbox. The message never says whether the account exists (the API answers the same
 * way either way).
 */
export function ForgotPasswordScreen() {
  // null = the form; a string = the address the link was requested for.
  const [sentTo, setSentTo] = useState<string | null>(null);

  return (
    <AuthShell
      panel={
        <BrandPanel
          headline="Forgot your password?"
          subtitle="It happens. We'll email you a link to choose a new one."
        />
      }
      headerLink={{
        prompt: "Remembered it?",
        label: "Log in",
        href: AUTH_ROUTES.login,
      }}
    >
      {sentTo === null ? (
        <>
          <AuthHeading
            title="Reset your password"
            subtitle="Enter the email address of your account and we'll send you a reset link."
          />
          <ForgotPasswordForm onDone={setSentTo} />
        </>
      ) : (
        <StatusPanel
          icon={Mail}
          title="Check your email"
          actions={
            <>
              <button
                type="button"
                onClick={() => setSentTo(null)}
                className={buttonStyles({ variant: "secondary" })}
              >
                Use a different email
              </button>
              <Link href={AUTH_ROUTES.login} className={buttonStyles()}>
                Back to log in
              </Link>
            </>
          }
        >
          If an account exists for{" "}
          <strong className="break-words text-foreground">{sentTo}</strong>,
          we&apos;ve sent a password reset link to it. The link expires in{" "}
          {PASSWORD_RESET_TOKEN_TTL_MINUTES} minutes.
        </StatusPanel>
      )}
    </AuthShell>
  );
}
