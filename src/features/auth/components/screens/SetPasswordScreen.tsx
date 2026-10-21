"use client";

import { CircleCheck, Clock, LockOpen } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge, buttonStyles } from "@/src/core/ui";
import { ACCOUNT_SETUP_TOKEN_TTL_HOURS } from "../../constants";
import { AUTH_ROUTES } from "../../routes";
import { SetPasswordForm } from "../forms/SetPasswordForm";
import { InviteBenefits } from "../preview/InviteBenefits";
import { AuthHeading } from "../shell/AuthHeading";
import { AuthShell } from "../shell/AuthShell";
import { BrandPanel } from "../shell/BrandPanel";
import { StatusPanel } from "../states/StatusPanel";

type Phase = "form" | "done" | "invalid";

/**
 * Opened from the invitation email (/set-password?token=...): set the first password, then log in.
 * Without a token the link is already known to be bad; a token the server rejects ends in the
 * same "expired" state.
 */
export function SetPasswordScreen({ token }: { token: string | null }) {
  const [phase, setPhase] = useState<Phase>("form");

  return (
    <AuthShell
      panel={
        <BrandPanel
          headline="You've been invited as an organizer."
          subtitle="An EventSphere administrator created your account. Set a password to activate it."
        >
          <InviteBenefits />
        </BrandPanel>
      }
      headerLink={{ prompt: "Already activated?", label: "Log in", href: AUTH_ROUTES.login }}
      supportPrompt="Didn't expect this invitation?"
    >
      {token === null || phase === "invalid" ? (
        <StatusPanel
          icon={LockOpen}
          tone="danger"
          title="This invitation link has expired"
          actions={
            <Link href={AUTH_ROUTES.login} className={buttonStyles({ variant: "secondary" })}>
              Back to log in
            </Link>
          }
        >
          Invitation links are valid for {ACCOUNT_SETUP_TOKEN_TTL_HOURS} hours. Ask your
          administrator to send a new one.
        </StatusPanel>
      ) : phase === "done" ? (
        <StatusPanel
          icon={CircleCheck}
          tone="success"
          title="Account activated"
          actions={
            <Link href={AUTH_ROUTES.login} className={buttonStyles({ fullWidth: true })}>
              Go to log in
            </Link>
          }
        >
          Your password is set. You can now log in with your email address and new password.
        </StatusPanel>
      ) : (
        <>
          <Badge tone="warning" className="mb-3">
            <Clock aria-hidden="true" className="size-3" />
            Invitation link · valid for {ACCOUNT_SETUP_TOKEN_TTL_HOURS} hours
          </Badge>
          <AuthHeading
            title="Set your password"
            subtitle="Choose a password to activate your organizer account."
          />
          <SetPasswordForm
            token={token}
            onDone={() => setPhase("done")}
            onLinkInvalid={() => setPhase("invalid")}
          />
        </>
      )}
    </AuthShell>
  );
}
