import type { Metadata } from "next";
import { InvitedNotice } from "@/src/features/auth/components/InvitedNotice";
import { LoginForm } from "@/src/features/auth/components/forms/LoginForm";
import { SchedulePreview } from "@/src/features/auth/components/preview/SchedulePreview";
import { AuthHeading } from "@/src/features/auth/components/shell/AuthHeading";
import { AuthShell } from "@/src/features/auth/components/shell/AuthShell";
import { BrandPanel } from "@/src/features/auth/components/shell/BrandPanel";
import { AUTH_ROUTES } from "@/src/features/auth/routes";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <AuthShell
      panel={
        <BrandPanel
          headline="Plan, run and attend events in one place."
          subtitle="Registrations, schedules, live polls and updates for attendees, organizers and speakers."
        >
          <SchedulePreview />
        </BrandPanel>
      }
      headerLink={{
        prompt: "New to EventSphere?",
        label: "Create an account",
        href: AUTH_ROUTES.signup,
      }}
    >
      <AuthHeading
        title="Log in"
        subtitle="Welcome back. Enter your email and password to continue."
      />
      <LoginForm />
      <InvitedNotice />
    </AuthShell>
  );
}
