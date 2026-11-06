import type { Metadata } from "next";
import { Suspense } from "react";
import {
  PublicSessionDetail,
  PublicSessionDetailSkeleton,
} from "@/src/features/sessions";

export const metadata: Metadata = { title: "Session" };

// DET-2: public, anyone (guests too) can open a scheduled session of a published event.
export default function PublicSessionPage(
  props: PageProps<"/events/[slug]/sessions/[sessionId]">,
) {
  return (
    // params is request data: with cacheComponents it must be read inside Suspense.
    <Suspense fallback={<PublicSessionDetailSkeleton />}>
      <SessionSection params={props.params} />
    </Suspense>
  );
}

async function SessionSection({
  params,
}: Pick<PageProps<"/events/[slug]/sessions/[sessionId]">, "params">) {
  const { slug, sessionId } = await params;
  // Whether this is a public session is decided by the API: a draft event, a draft or cancelled
  // session, an unknown or a badly formed link is a 404 or 400.
  return <PublicSessionDetail slug={slug} sessionId={sessionId} />;
}
