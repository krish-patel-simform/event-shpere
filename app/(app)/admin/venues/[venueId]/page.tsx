import type { Metadata } from "next";
import { Suspense } from "react";
import { PermissionGate } from "@/src/features/auth";
import { AdminVenueDetail } from "@/src/features/venues";

export const metadata: Metadata = { title: "Venue" };

// Admin only: retiring needs VENUE_MANAGE, the halls need HALL_MANAGE. A guest sees "log in",
// anyone else without them "no access". The API checks the same permissions.
export default function AdminVenueDetailPage(
  props: PageProps<"/admin/venues/[venueId]">,
) {
  return (
    <PermissionGate permissions={["VENUE_MANAGE", "HALL_MANAGE"]}>
      {/* params is request data: with cacheComponents it must be read inside Suspense. */}
      <Suspense fallback={null}>
        <VenueSection params={props.params} />
      </Suspense>
    </PermissionGate>
  );
}

async function VenueSection({
  params,
}: Pick<PageProps<"/admin/venues/[venueId]">, "params">) {
  const { venueId } = await params;
  // Whether this id is a venue is decided by the API: an unknown id is a 404, a badly formed
  // one a 400.
  return <AdminVenueDetail venueId={venueId} />;
}
