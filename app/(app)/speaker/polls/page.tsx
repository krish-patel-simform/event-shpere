import type { Metadata } from "next";
import { PermissionGate } from "@/src/features/auth";
import { LivePollsPage } from "@/src/features/polls";

export const metadata: Metadata = { title: "Live polls & Q&A" };

// Speakers only: POLL_CREATE_ASSIGNED is "create polls for own sessions". Shows sample data until
// the polls API exists; the API will check the same permission and that the session is theirs.
export default function SpeakerPollsPage() {
  return (
    <PermissionGate permissions={["POLL_CREATE_ASSIGNED"]}>
      <LivePollsPage />
    </PermissionGate>
  );
}
