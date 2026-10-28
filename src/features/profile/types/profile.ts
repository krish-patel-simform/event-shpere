import type { RoleName } from "@/src/db/schemas";

/** The signed-in person's own details, as the "Profile & settings" page shows them. */
export type ProfileDetails = {
  firstName: string;
  lastName: string;
  /** Read-only on this page: changing the email is a separate flow. */
  email: string;
  emailVerified: boolean;
  /** One role per person. */
  role: RoleName;
};

/** One email-notification choice. The switches are shown but not working yet (no API). */
export type NotificationTopic = {
  id: string;
  label: string;
  description: string;
};

/** A setting the design shows that the app cannot do yet. */
export type UnavailableFeature = {
  id: string;
  label: string;
  description: string;
};
