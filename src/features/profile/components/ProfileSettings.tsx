"use client";

import { useHasPermission } from "@/src/features/auth";
import type {
  ChangePasswordFormValues,
  ProfileFormValues,
} from "../schemas/profile.schemas";
import type { ProfileDetails } from "../types/profile";
import {
  EVENT_NOTIFICATION_TOPICS,
  PLATFORM_NOTIFICATION_TOPICS,
  PROFILE_SAMPLE,
  UNAVAILABLE_FEATURES,
} from "../utils/profile.sample";
import { AppearanceCard } from "./AppearanceCard";
import { ChangePasswordCard } from "./ChangePasswordCard";
import { EmailNotificationsCard } from "./EmailNotificationsCard";
import { ProfileDetailsCard } from "./ProfileDetailsCard";
import { UnavailableSettingsCard } from "./UnavailableSettingsCard";

type ProfileSettingsProps = {
  /** The signed-in person. Sample data until the API is wired. */
  profile?: ProfileDetails;
  onSaveProfile?: (values: ProfileFormValues) => void | Promise<void>;
  onChangePassword?: (values: ChangePasswordFormValues) => void | Promise<void>;
};

const SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "security", label: "Sign-in & security" },
  { id: "appearance", label: "Appearance" },
  { id: "email-notifications", label: "Email notifications" },
  { id: "not-available", label: "Not available yet" },
] as const;

/**
 * "Profile & settings": one page for every role, with one role badge. What differs is chosen by
 * permission, never by role name: editing needs PROFILE_MANAGE, the email topics depend on
 * ORGANIZER_VERIFY (platform topics) or not (event topics), and the card needs NOTIFICATION_MANAGE.
 * It shows sample data and sends nothing to a server yet.
 */
export function ProfileSettings({
  profile = PROFILE_SAMPLE,
  onSaveProfile,
  onChangePassword,
}: ProfileSettingsProps) {
  const canManageProfile = useHasPermission("PROFILE_MANAGE");
  const canManageNotifications = useHasPermission("NOTIFICATION_MANAGE");
  const reviewsOrganizers = useHasPermission("ORGANIZER_VERIFY");

  const visibleSections = SECTIONS.filter(
    (section) => section.id !== "email-notifications" || canManageNotifications,
  );

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Profile & settings</h1>
        <p className="text-muted">
          Manage your profile, sign-in details and preferences.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start">
        <nav
          aria-label="Settings sections"
          className="flex flex-wrap gap-1 rounded-lg border border-line bg-surface p-2 lg:sticky lg:top-4 lg:flex-col"
        >
          {visibleSections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted hover:bg-surface-subtle hover:text-foreground"
            >
              {section.label}
            </a>
          ))}
        </nav>

        <div className="min-w-0 space-y-5">
          <div id="profile" className="scroll-mt-4">
            <ProfileDetailsCard
              profile={profile}
              canEdit={canManageProfile}
              onSubmit={onSaveProfile}
            />
          </div>
          <div id="security" className="scroll-mt-4">
            <ChangePasswordCard
              canEdit={canManageProfile}
              onSubmit={onChangePassword}
            />
          </div>
          <div id="appearance" className="scroll-mt-4">
            <AppearanceCard />
          </div>
          {canManageNotifications && (
            <div id="email-notifications" className="scroll-mt-4">
              <EmailNotificationsCard
                email={profile.email}
                topics={
                  reviewsOrganizers
                    ? PLATFORM_NOTIFICATION_TOPICS
                    : EVENT_NOTIFICATION_TOPICS
                }
              />
            </div>
          )}
          <div id="not-available" className="scroll-mt-4">
            <UnavailableSettingsCard features={UNAVAILABLE_FEATURES} />
          </div>
        </div>
      </div>
    </div>
  );
}
