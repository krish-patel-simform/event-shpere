"use client";

import { CircleCheck, Clock, LockOpen } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge, buttonStyles } from "@/src/core/ui";
import { PASSWORD_RESET_TOKEN_TTL_MINUTES } from "../../constants";
import { AUTH_ROUTES } from "../../routes";
import { ResetPasswordForm } from "../forms/ResetPasswordForm";
import { AuthHeading } from "../shell/AuthHeading";
import { AuthShell } from "../shell/AuthShell";
import { BrandPanel } from "../shell/BrandPanel";
import { StatusPanel } from "../states/StatusPanel";

type Phase = "form" | "done";

/**
 * Opened from the password reset email (/reset-password?token=...): choose a new password, then
 * log in. Without a token the link is already known to be bad, so the expired state shows.
 * UI only for now: the form does not call the API yet.
 */
export function ResetPasswordScreen({ token }: { token: string | null }) {
  const [phase, setPhase] = useState<Phase>("form");

  return (
    <AuthShell
      panel={
        <BrandPanel
          headline="Let's get you back in."
          subtitle="Choose a new password for your EventSphere account."
        />
      }
      headerLink={{
        prompt: "Remembered it?",
        label: "Log in",
        href: AUTH_ROUTES.login,
      }}
      supportPrompt="Didn't ask for this?"
    >
      {token === null ? (
        <StatusPanel
          icon={LockOpen}
          tone="danger"
          title="This reset link is invalid or has expired"
          actions={
            <>
              <Link
                href={AUTH_ROUTES.login}
                className={buttonStyles({ variant: "secondary" })}
              >
                Back to log in
              </Link>
              <Link
                href={AUTH_ROUTES.forgotPassword}
                className={buttonStyles()}
              >
                Request a new link
              </Link>
            </>
          }
        >
          Reset links are valid for {PASSWORD_RESET_TOKEN_TTL_MINUTES} minutes
          and work only once. Request a new one to continue.
        </StatusPanel>
      ) : phase === "done" ? (
        <StatusPanel
          icon={CircleCheck}
          tone="success"
          title="Password updated"
          actions={
            <Link
              href={AUTH_ROUTES.login}
              className={buttonStyles({ fullWidth: true })}
            >
              Go to log in
            </Link>
          }
        >
          Your password has been changed. Log in with your email address and new
          password.
        </StatusPanel>
      ) : (
        <>
          <Badge tone="warning" className="mb-3">
            <Clock aria-hidden="true" className="size-3" />
            Reset link · valid for {PASSWORD_RESET_TOKEN_TTL_MINUTES} minutes
          </Badge>
          <AuthHeading
            title="Choose a new password"
            subtitle="Use a password you haven't used before."
          />
          <ResetPasswordForm token={token} onDone={() => setPhase("done")} />
        </>
      )}
    </AuthShell>
  );
}
