import type { Metadata } from "next";
import { Suspense } from "react";
import {
  PublicEventDetail,
  PublicEventDetailSkeleton,
} from "@/src/features/events";

export const metadata: Metadata = { title: "Event" };

// DISC-1: public, anyone (guests too) can open a published event.
export default function EventPage(props: PageProps<"/events/[slug]">) {
  return (
    // params is request data: with cacheComponents it must be read inside Suspense.
    <Suspense fallback={<PublicEventDetailSkeleton />}>
      <EventSection params={props.params} />
    </Suspense>
  );
}

async function EventSection({
  params,
}: Pick<PageProps<"/events/[slug]">, "params">) {
  const { slug } = await params;
  // Whether this slug is a public event is decided by the API: a draft, an unknown or a badly
  // formed slug is a 404 or 400.
  return <PublicEventDetail slug={slug} />;
}
