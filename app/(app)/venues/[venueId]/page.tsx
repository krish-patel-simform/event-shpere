import type { Metadata } from "next";
import { Suspense } from "react";
import { VenueProfile, VenueProfileSkeleton } from "@/src/features/venues";

export const metadata: Metadata = { title: "Venue" };

// Discover: public, anyone can open an active venue and see its active halls.
export default function VenuePage(props: PageProps<"/venues/[venueId]">) {
  return (
    // params is request data: with cacheComponents it must be read inside Suspense.
    <Suspense fallback={<VenueProfileSkeleton />}>
      <VenueSection params={props.params} />
    </Suspense>
  );
}

async function VenueSection({
  params,
}: Pick<PageProps<"/venues/[venueId]">, "params">) {
  const { venueId } = await params;
  // Whether this id is an active venue is decided by the API: unknown or inactive is a 404, a
  // badly formed id a 400.
  return <VenueProfile venueId={venueId} />;
}
