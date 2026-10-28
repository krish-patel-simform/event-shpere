import type { Metadata } from "next";
import { PermissionGate } from "@/src/features/auth";
import { OwnSpeakerProfile } from "@/src/features/speakers";

export const metadata: Metadata = { title: "Edit my profile" };

// Speakers only: SPEAKER_MANAGE_OWN is "edit own speaker bio, photo and social links". The
// content loads and saves through /api/me/speaker-profile (details) and its /photo route, which
// check the same permission and only ever edit the caller's own profile.
export default function SpeakerProfilePage() {
  return (
    <PermissionGate permissions={["SPEAKER_MANAGE_OWN"]}>
      <OwnSpeakerProfile />
    </PermissionGate>
  );
}
