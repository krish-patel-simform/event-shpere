import type { Metadata } from "next";
import { Alert, Badge } from "@/src/core/ui";
import { OrganizerSignupForm } from "@/src/features/auth/components/forms/OrganizerSignupForm";
import { BoardPreview } from "@/src/features/auth/components/preview/BoardPreview";
import { AuthHeading } from "@/src/features/auth/components/shell/AuthHeading";
import { AuthShell } from "@/src/features/auth/components/shell/AuthShell";
import { BrandPanel } from "@/src/features/auth/components/shell/BrandPanel";
import { AUTH_ROUTES } from "@/src/features/auth/routes";

export const metadata: Metadata = { title: "Apply as an organizer" };

export default function OrganizerSignupPage() {
  return (
    <AuthShell
      panel={
        <BrandPanel
          headline="Run your next event from one dashboard."
          subtitle="Set up halls, drag sessions onto the schedule, assign speakers and track registrations."
        >
          <BoardPreview />
        </BrandPanel>
      }
      backLink={{ label: "Change account type", href: AUTH_ROUTES.signup }}
      headerLink={{ prompt: "Already have an account?", label: "Log in", href: AUTH_ROUTES.login }}
      width="wide"
    >
      <Badge tone="warning" className="mb-3">
        Organizer account
      </Badge>
      <AuthHeading
        title="Apply as an organizer"
        subtitle="Create your account and tell us about your organisation."
      />
      {/* The brand panel (which says this too) is hidden on small screens. */}
      <Alert tone="info" title="Every organisation is reviewed" className="mb-5 lg:hidden">
        After you verify your email, our team checks your organisation details. Event tools unlock
        once you&apos;re approved.
      </Alert>
      <OrganizerSignupForm />
    </AuthShell>
  );
}
