import type { Metadata } from "next";
import { Building2, Info, Ticket } from "lucide-react";
import { AccountTypeCard } from "@/src/features/auth/components/AccountTypeCard";
import { ProgressTracker, type ProgressStep } from "@/src/features/auth/components/preview/ProgressTracker";
import { AuthHeading } from "@/src/features/auth/components/shell/AuthHeading";
import { AuthShell } from "@/src/features/auth/components/shell/AuthShell";
import { BrandPanel } from "@/src/features/auth/components/shell/BrandPanel";
import { AUTH_ROUTES } from "@/src/features/auth/routes";

export const metadata: Metadata = { title: "Create an account" };

const STEPS: readonly ProgressStep[] = [
  { title: "Create your account", description: "Tell us who you are and choose a password." },
  { title: "Verify your email", description: "Open the link we email you and enter the 6-digit code." },
  { title: "Log in", description: "Attendees can register for events straight away." },
  {
    title: "Organizer approval",
    badge: "Organizers only",
    optional: true,
    description: "Our team reviews your organisation before event tools unlock.",
  },
];

export default function SignupPage() {
  return (
    <AuthShell
      panel={
        <BrandPanel
          headline="Getting started takes about two minutes."
          subtitle="Create your account, confirm your email, and you're ready to go."
        >
          <ProgressTracker steps={STEPS} />
        </BrandPanel>
      }
      headerLink={{ prompt: "Already have an account?", label: "Log in", href: AUTH_ROUTES.login }}
    >
      <AuthHeading
        title="Create an account"
        subtitle="How will you use EventSphere? You can apply to become an organizer later from your profile."
      />
      <div className="space-y-4">
        <AccountTypeCard
          href={AUTH_ROUTES.signupUser}
          icon={Ticket}
          title="I'm attending events"
          description="Discover events, register, build your schedule and take part in live polls."
          features={[
            { label: "Free account", icon: "check" },
            { label: "Ready after email verification", icon: "check" },
          ]}
        />
        <AccountTypeCard
          href={AUTH_ROUTES.signupOrganizer}
          icon={Building2}
          title="I'm organizing events"
          description="Create events, set up halls and sessions, manage speakers and attendees."
          features={[
            { label: "Organisation details required", icon: "check" },
            { label: "Reviewed by our team", icon: "pending" },
          ]}
        />
      </div>
      <p className="mt-6 flex gap-2 text-sm text-muted">
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <span>
          <strong className="text-foreground">Speaking at an event?</strong> Speakers are added by
          the event organizer, so there&apos;s no need to sign up here.
        </span>
      </p>
    </AuthShell>
  );
}
