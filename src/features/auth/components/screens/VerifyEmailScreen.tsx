"use client";

import { CheckCircle2, Link2Off, Lock } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { buttonStyles } from "@/src/core/ui";
import { useAppDispatch } from "@/src/redux/store";
import { verificationCleared } from "@/src/redux/slices/auth-flow.slice";
import { AUTH_ROUTES } from "../../routes";
import { VerifyEmailForm } from "../forms/VerifyEmailForm";
import { ProgressTracker, type ProgressStep } from "../preview/ProgressTracker";
import { AuthShell } from "../shell/AuthShell";
import { BrandPanel } from "../shell/BrandPanel";
import { StatusPanel } from "../states/StatusPanel";

const ENTER_CODE_STEPS: ProgressStep[] = [
  { title: "Account created", status: "done" },
  { title: "Verify your email", description: "In progress", status: "current" },
  { title: "Log in", status: "upcoming" },
];

const VERIFIED_STEPS: ProgressStep[] = [
  { title: "Account created", status: "done" },
  { title: "Email verified", status: "done" },
  { title: "Log in", description: "Next step", status: "current" },
];

/**
 * Opened from the link in the signup email (/verify-email?token=...). Shows the code form,
 * then "Email verified". Without a token the link is already known to be bad; a token the
 * server rejects ends in the same "invalid or expired" state.
 */
export function VerifyEmailScreen({ token }: { token: string | null }) {
  const dispatch = useAppDispatch();
  const [verified, setVerified] = useState(false);
  const [linkInvalid, setLinkInvalid] = useState(false);

  function handleVerified() {
    setVerified(true);
    // The signup details are no longer needed: remove the email address from sessionStorage.
    dispatch(verificationCleared());
  }

  const panel = verified ? (
    <BrandPanel
      headline="You're all set."
      subtitle="Log in to browse events and start building your schedule."
    >
      <ProgressTracker heading="Your progress" steps={VERIFIED_STEPS} />
    </BrandPanel>
  ) : (
    <BrandPanel
      headline="One last step."
      subtitle="Enter the code from your email to confirm your address."
    >
      <div className="space-y-6">
        <ProgressTracker heading="Your progress" steps={ENTER_CODE_STEPS} />
        <p className="flex gap-3 text-sm text-panel-muted">
          <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          We never ask for your password by email. EventSphere codes are only
          entered on this page.
        </p>
      </div>
    </BrandPanel>
  );

  return (
    <AuthShell
      panel={panel}
      backLink={
        verified
          ? undefined
          : { label: "Back to log in", href: AUTH_ROUTES.login }
      }
    >
      {verified ? (
        <VerifiedContent />
      ) : token === null || linkInvalid ? (
        <StatusPanel
          icon={Link2Off}
          tone="danger"
          title="This link is invalid or has expired"
          actions={
            <Link
              href={AUTH_ROUTES.login}
              className={buttonStyles({ variant: "secondary" })}
            >
              Back to log in
            </Link>
          }
        >
          Verification links work for 5 minutes and can only be used once.
        </StatusPanel>
      ) : (
        <VerifyEmailForm
          token={token}
          onVerified={handleVerified}
          onLinkInvalid={() => setLinkInvalid(true)}
        />
      )}
    </AuthShell>
  );
}

function VerifiedContent() {
  return (
    <div className="space-y-5">
      <StatusPanel
        icon={CheckCircle2}
        tone="success"
        title="Email verified"
        actions={
          <Link
            href={AUTH_ROUTES.login}
            className={buttonStyles({ fullWidth: true })}
          >
            Go to log in
          </Link>
        }
      >
        Your email address has been confirmed. You can now log in to your
        account.
      </StatusPanel>

      <section className="rounded-lg border border-line bg-surface-subtle p-4 text-sm">
        <h2 className="font-semibold">Applied as an organizer?</h2>
        <p className="text-muted">
          You can log in now. Your organisation is being reviewed, and event
          tools unlock once it&apos;s approved.
        </p>
      </section>
    </div>
  );
}
