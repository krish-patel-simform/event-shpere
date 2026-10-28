import type { Metadata } from "next";
import { PermissionGate } from "@/src/features/auth";
import { MySessions } from "@/src/features/sessions";

export const metadata: Metadata = { title: "My sessions" };

// Speakers only: SPEAKER_MANAGE_OWN. A guest sees "log in", anyone else without it "no access".
// The API will check the same permission, and that the session is theirs.
export default function MySessionsPage() {
  return (
    <PermissionGate permissions={["SPEAKER_MANAGE_OWN"]}>
      <MySessions />
    </PermissionGate>
  );
}
