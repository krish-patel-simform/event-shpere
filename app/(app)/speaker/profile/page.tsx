import type { Metadata } from "next";
import { PermissionGate } from "@/src/features/auth";
import { SpeakerProfileForm } from "@/src/features/speakers";

export const metadata: Metadata = { title: "Edit my profile" };

// Speakers only: SPEAKER_MANAGE_OWN is "edit own speaker bio, photo and social links". Shows
// sample data until the form is wired to /api/me/speaker-profile, which checks the same
// permission and only ever edits the caller's own profile.
export default function SpeakerProfilePage() {
  return (
    <PermissionGate permissions={["SPEAKER_MANAGE_OWN"]}>
      <SpeakerProfileForm />
    </PermissionGate>
  );
}
