import type { Metadata } from "next";
import { PermissionGate } from "@/src/features/auth";
import { ProfileSettings } from "@/src/features/profile";

export const metadata: Metadata = { title: "Profile & settings" };

// Any signed-in person with PROFILE_VIEW. Sample data for now: the API for it does not exist yet.
export default function ProfilePage() {
  return (
    <PermissionGate permissions={["PROFILE_VIEW"]}>
      <ProfileSettings />
    </PermissionGate>
  );
}
