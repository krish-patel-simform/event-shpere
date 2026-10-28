import type { Metadata } from "next";
import { Suspense } from "react";
import { PermissionGate } from "@/src/features/auth";
import { SessionDetail, SessionDetailSkeleton } from "@/src/features/sessions";

export const metadata: Metadata = { title: "Session" };

// Speakers only: SPEAKER_MANAGE_OWN. The API will also check that the session is the speaker's own.
export default function SessionPage(
  props: PageProps<"/speaker/sessions/[sessionId]">,
) {
  return (
    <PermissionGate permissions={["SPEAKER_MANAGE_OWN"]}>
      {/* params is request data: with cacheComponents it must be read inside Suspense. */}
      <Suspense fallback={<SessionDetailSkeleton />}>
        <SessionSection params={props.params} />
      </Suspense>
    </PermissionGate>
  );
}

async function SessionSection({
  params,
}: Pick<PageProps<"/speaker/sessions/[sessionId]">, "params">) {
  const { sessionId } = await params;
  // Whether this id is one of the speaker's sessions is decided by the (future) API; with sample
  // data an unknown id shows "Session not found".
  return <SessionDetail sessionId={sessionId} />;
}
