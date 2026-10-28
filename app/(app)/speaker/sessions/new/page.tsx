import type { Metadata } from "next";
import { PermissionGate } from "@/src/features/auth";
import { SubmitSession } from "@/src/features/sessions";

export const metadata: Metadata = { title: "Submit a session" };

// Speakers only: SPEAKER_MANAGE_OWN. `new` is a static segment, so Next.js matches it before
// [sessionId]. The form sends nothing yet (no sessions API).
export default function SubmitSessionPage() {
  return (
    <PermissionGate permissions={["SPEAKER_MANAGE_OWN"]}>
      <SubmitSession />
    </PermissionGate>
  );
}
