"use client";

import { MailQuestion } from "lucide-react";
import Link from "next/link";
import { useIsClient } from "@/src/core/hooks/use-is-client";
import { buttonStyles } from "@/src/core/ui";
import { selectAuthFlowRehydrated, useAppDispatch, useAppSelector } from "@/src/redux/store";
import { AUTH_ROUTES } from "../../routes";
import { selectPendingVerification, verificationCleared } from "../../store/auth-flow.slice";
import { ProgressTracker, type ProgressStep } from "../preview/ProgressTracker";
import { AuthShell } from "../shell/AuthShell";
import { BrandPanel } from "../shell/BrandPanel";
import { CheckEmailPanel } from "../states/CheckEmailPanel";
import { StatusPanel } from "../states/StatusPanel";

function progressSteps(expiresInMinutes: number | null): ProgressStep[] {
  return [
    { title: "Account created", description: "Just now", status: "done" },
    {
      title: "Verify your email",
      description: expiresInMinutes
        ? `In progress · code expires in ${expiresInMinutes} minutes`
        : "In progress",
      status: "current",
    },
    { title: "Log in", description: "After your email is verified", status: "upcoming" },
  ];
}

/** Screen after signup. Reads what to show from the persisted authFlow store. */
export function CheckEmailScreen() {
  const dispatch = useAppDispatch();
  // The stored signup only exists in the browser. Until hydration is done AND sessionStorage has
  // been read, show the placeholder the server rendered, so hydration matches.
  const rehydrated = useAppSelector(selectAuthFlowRehydrated);
  const storedSignup = useAppSelector(selectPendingVerification);
  const ready = useIsClient() && rehydrated;
  // Everything below, the side panel included, must use this and not read the store directly.
  const pending = ready ? storedSignup : null;

  return (
    <AuthShell
      panel={
        <BrandPanel
          headline="Almost there."
          subtitle="Confirm your email address so we know it's really you."
        >
          <ProgressTracker heading="Your progress" steps={progressSteps(pending?.expiresInMinutes ?? null)} />
        </BrandPanel>
      }
      headerLink={{ prompt: "Already verified?", label: "Log in", href: AUTH_ROUTES.login }}
    >
      {!ready ? (
        <div role="status" aria-label="Loading" className="animate-pulse space-y-4 motion-reduce:animate-none">
          <div className="size-14 rounded-full bg-surface-subtle" />
          <div className="h-7 w-48 rounded bg-surface-subtle" />
          <div className="h-16 rounded bg-surface-subtle" />
        </div>
      ) : pending ? (
        <CheckEmailPanel pending={pending} onStartAgain={() => dispatch(verificationCleared())} />
      ) : (
        // Opened directly, in another tab, or after the signup was already verified.
        <StatusPanel
          icon={MailQuestion}
          title="No signup to verify"
          actions={
            <>
              <Link href={AUTH_ROUTES.login} className={buttonStyles({ variant: "secondary" })}>
                Log in
              </Link>
              <Link href={AUTH_ROUTES.signup} className={buttonStyles()}>
                Create an account
              </Link>
            </>
          }
        >
          We don&apos;t have a signup waiting for verification in this browser. If you already verified
          your email, you can log in.
        </StatusPanel>
      )}
    </AuthShell>
  );
}
