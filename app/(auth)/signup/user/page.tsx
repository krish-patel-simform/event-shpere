import type { Metadata } from "next";
import { UserSignupForm } from "@/src/features/auth/components/forms/UserSignupForm";
import { EventPreview } from "@/src/features/auth/components/preview/EventPreview";
import { AuthHeading } from "@/src/features/auth/components/shell/AuthHeading";
import { AuthShell } from "@/src/features/auth/components/shell/AuthShell";
import { BrandPanel } from "@/src/features/auth/components/shell/BrandPanel";
import { Badge } from "@/src/core/ui";
import { AUTH_ROUTES } from "@/src/features/auth/routes";

export const metadata: Metadata = { title: "Create your account" };

export default function UserSignupPage() {
  return (
    <AuthShell
      panel={
        <BrandPanel
          headline="Find an event. Save your seat. Plan your day."
          subtitle="As an attendee you can register for events, book sessions and vote in live polls."
        >
          <EventPreview />
        </BrandPanel>
      }
      backLink={{ label: "Change account type", href: AUTH_ROUTES.signup }}
      width="wide"
      headerLink={{ prompt: "Already have an account?", label: "Log in", href: AUTH_ROUTES.login }}
    >
      <Badge tone="brand" className="mb-3">
        Attendee account
      </Badge>
      <AuthHeading
        title="Create your account"
        subtitle="We'll email you a link and a 6-digit code to confirm your address."
      />
      <UserSignupForm />
    </AuthShell>
  );
}
